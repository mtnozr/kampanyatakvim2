/**
 * Reminder Helper Functions
 * Hatırlatma sisteminin yardımcı fonksiyonları
 */

import {
  CalendarEvent,
  AnalyticsTask,
  ReminderSettings,
  ReminderLog,
  User,
  AnalyticsUser
} from '../types';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { sendEmailWithResend, buildCustomEmailHTML } from './emailService';

/**
 * Bugün hafta sonu mu kontrol eder (Cumartesi veya Pazar)
 */
export function isWeekend(): boolean {
  const today = new Date();
  const day = today.getDay();
  return day === 0 || day === 6; // 0 = Pazar, 6 = Cumartesi
}

/**
 * Bir event'in hatırlatma göndermesi gerekip gerekmediğini kontrol eder
 */
export function shouldSendReminder(
  event: CalendarEvent | AnalyticsTask,
  reminderSettings: ReminderSettings,
  testMode: boolean = false
): boolean {
  if (!reminderSettings.isEnabled) return false;
  if (!event.assigneeId) return false;
  if (event.status === 'Tamamlandı' || event.status === 'İptal Edildi') return false;

  // TEST MODE: Tüm tarihleri bypass et, sadece aktif görevleri kontrol et
  if (testMode) {
    return true;
  }

  if (!event.createdAt) return false;

  // Hafta sonu kontrolü - Cumartesi ve Pazar mail gönderme
  if (isWeekend()) {
    return false;
  }

  const daysElapsed = getDaysElapsed(event.createdAt);
  const reminderThreshold = reminderSettings.reminderRules[event.urgency];

  return daysElapsed >= reminderThreshold;
}

/**
 * Event oluşturulduğundan bu yana geçen gün sayısını hesaplar
 */
export function getDaysElapsed(createdAt: Date): number {
  const now = new Date();
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Event için daha önce hatırlatma gönderilmiş mi kontrol eder
 */
export async function hasReminderBeenSent(
  eventId: string,
  eventType: 'campaign' | 'analytics'
): Promise<boolean> {
  try {
    const logsRef = collection(db, 'reminderLogs');
    const q = query(
      logsRef,
      where('eventId', '==', eventId),
      where('eventType', '==', eventType),
      where('status', '==', 'success')
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking reminder logs:', error);
    return false;
  }
}

/**
 * Hatırlatma maili gönderir ve log'a kaydeder
 */
export async function sendReminderEmail(
  event: CalendarEvent | AnalyticsTask,
  eventType: 'campaign' | 'analytics',
  assignee: User | AnalyticsUser,
  reminderSettings: ReminderSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    // API key kontrolü
    if (!reminderSettings.resendApiKey) {
      return { success: false, error: 'Resend API key tanımlanmamış' };
    }

    // Email HTML oluştur (custom template kullan)
    const daysElapsed = getDaysElapsed(event.createdAt || new Date());
    const emailHTML = buildCustomEmailHTML({
      assigneeName: assignee.name,
      eventTitle: event.title,
      eventType,
      urgency: event.urgency,
      daysElapsed,
      customBodyTemplate: reminderSettings.emailBodyTemplate,
    });

    // Subject template'ini kullan
    const subject = reminderSettings.emailSubjectTemplate
      .replace('{title}', event.title)
      .replace('{urgency}', event.urgency)
      .replace('{days}', daysElapsed.toString());

    // Email gönder
    const result = await sendEmailWithResend(reminderSettings.resendApiKey, {
      to: assignee.email,
      toName: assignee.name,
      subject,
      html: emailHTML,
      eventId: event.id,
      eventTitle: event.title,
      eventType,
      urgency: event.urgency,
    });

    // Log kaydet
    await saveReminderLog({
      eventId: event.id,
      eventType,
      eventTitle: event.title,
      recipientEmail: assignee.email,
      recipientName: assignee.name,
      urgency: event.urgency,
      sentAt: new Date(),
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      emailProvider: 'resend',
      messageId: result.messageId,
    });

    return {
      success: result.success,
      error: result.error
    };
  } catch (error) {
    console.error('Error sending reminder email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    };
  }
}

/**
 * Reminder log'u Firestore'a kaydeder
 */
async function saveReminderLog(log: Omit<ReminderLog, 'id'>): Promise<void> {
  try {
    const logsRef = collection(db, 'reminderLogs');
    await addDoc(logsRef, {
      ...log,
      sentAt: Timestamp.fromDate(log.sentAt),
    });
  } catch (error) {
    console.error('Error saving reminder log:', error);
  }
}

/**
 * Tüm bekleyen event'ler için hatırlatma kontrolü yapar
 */
export async function processReminders(
  events: (CalendarEvent | AnalyticsTask)[],
  eventType: 'campaign' | 'analytics',
  users: (User | AnalyticsUser)[],
  reminderSettings: ReminderSettings,
  testMode: boolean = false
): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of events) {
    try {
      // Hatırlatma gerekli mi?
      if (!shouldSendReminder(event, reminderSettings, testMode)) {
        skipped++;
        continue;
      }

      // Test modunda daha önce gönderilmiş olsa bile gönder
      if (!testMode) {
        // Daha önce gönderilmiş mi?
        const alreadySent = await hasReminderBeenSent(event.id, eventType);
        if (alreadySent) {
          skipped++;
          continue;
        }
      }

      // Atanan kişiyi bul
      const assignee = users.find(u => u.id === event.assigneeId);
      if (!assignee || !assignee.email) {
        skipped++;
        continue;
      }

      // Email gönder
      const result = await sendReminderEmail(event, eventType, assignee, reminderSettings);

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      // Rate limiting için küçük gecikme
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error processing reminder for event:', event.id, error);
      failed++;
    }
  }

  return { sent, failed, skipped };
}
