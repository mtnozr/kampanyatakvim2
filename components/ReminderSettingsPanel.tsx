import React, { useState, useEffect } from 'react';
import { Save, Send, Check, X, AlertCircle, Mail, Settings, Play, FileText, Eye, Smartphone, Users } from 'lucide-react';
import { ReminderSettings, ReminderLog, CalendarEvent, AnalyticsTask, User, AnalyticsUser, Report, DepartmentUser } from '../types';
import { db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  where,
  addDoc,
  collection
} from 'firebase/firestore';
import { sendTestEmail } from '../utils/emailService';
import { sendTestSMS, formatPhoneNumber } from '../utils/smsService';

import { buildWeeklyDigest } from '../utils/weeklyDigestBuilder';
import { buildWeeklyDigestHTML, sendWeeklyDigestEmail, buildDailyDigestHTML, sendDailyDigestEmail } from '../utils/emailService';
import { buildDailyDigest } from '../utils/dailyDigestBuilder';


// Add logging helper
async function logAutomatedCheck(message: string) {
  try {
    // Optional: log to a specific collection for debugging automation
    console.log(`[Auto-Scheduler] ${message}`);
  } catch (e) {
    console.error(e);
  }
}

export default function ReminderSettingsPanel() {
  const [settings, setSettings] = useState<ReminderSettings>({
    id: 'default',
    emailProvider: 'resend',
    resendApiKey: '',
    isEnabled: false,
    reminderRules: {
      'Very High': 1,
      'High': 2,
      'Medium': 2,
      'Low': 2,
    },
    emailSubjectTemplate: '⏰ Hatırlatma: {title}',
    emailBodyTemplate: `Lütfen "{title}" görevinizin durumunu kontrol edin ve gerekli aksiyonları alın.

Görev üzerinden {days} gün geçti ve aciliyet seviyesi {urgency} olarak işaretlendi.

Herhangi bir sorun veya gecikme varsa lütfen yöneticinizle iletişime geçin.`,
    twilioEnabled: false,
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    smsTemplate: '{title} görevi size atandı. Kampanya Takvimi',
    reportDelayNotificationsEnabled: false,
    reportDelayThresholdDays: 0,
    updatedAt: new Date(),
  });

  const [recentLogs, setRecentLogs] = useState<ReminderLog[]>([]);
  const [departmentUsers, setDepartmentUsers] = useState<DepartmentUser[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingSMS, setIsTestingSMS] = useState(false);

  const [digestPreviewOpen, setDigestPreviewOpen] = useState(false);
  const [digestPreviewHTML, setDigestPreviewHTML] = useState('');
  const [digestRecipients, setDigestRecipients] = useState<DepartmentUser[]>([]);
  const [isBuildingDigest, setIsBuildingDigest] = useState(false);
  const [isSendingDigest, setIsSendingDigest] = useState(false);
  const [dailyDigestPreviewOpen, setDailyDigestPreviewOpen] = useState(false);
  const [dailyDigestPreviewHTML, setDailyDigestPreviewHTML] = useState('');
  const [isBuildingDailyDigest, setIsBuildingDailyDigest] = useState(false);
  const [isSendingDailyDigest, setIsSendingDailyDigest] = useState(false);
  const [dailyDigestRecipients, setDailyDigestRecipients] = useState<DepartmentUser[]>([]);



  const [saveMessage, setSaveMessage] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testSMSMessage, setTestSMSMessage] = useState('');
  const [processMessage, setProcessMessage] = useState('');

  // Load settings from Firestore
  useEffect(() => {
    loadSettings();
    loadRecentLogs();
    loadDepartmentUsers();
  }, []);

  // Automatic Daily Digest Scheduler
  // DEPRECATED: Now handled by Vercel Cron (Serverless) @ api/cron-daily-digest.ts
  // This client-side check is disabled to prevent multiple triggers and requirement of open tab.
  /*
  useEffect(() => {
    // Check every minute
    const intervalId = setInterval(async () => {
      if (!settings.dailyDigestEnabled || !settings.resendApiKey) return;

      try {
        const now = new Date();
        const { campaigns, users, deptUsers } = await fetchPanelData();

        // This processDailyDigest function handles time checking internally
        // It checks if current time matches target time AND if not sent today
        // We added a Firestore Transaction Lock inside it to prevent race conditions across tabs/users
        const result = await processDailyDigest(campaigns, users, deptUsers, settings);

        if (result.sent > 0 || result.failed > 0) {
          console.log('Automatic digest run:', result);
          setProcessMessage(`✅ Gün sonu bülteni otomatik gönderildi: ${result.sent} başarılı`);
          setTimeout(() => setProcessMessage(''), 5000);
          loadRecentLogs();
        } else if (result.skipped > 0) {
          // Optionally log skipped attempts due to lock
          // console.log('Digest skipped (locked or already sent)');
        }
      } catch (error) {
        console.error('Auto digest error:', error);
      }
    }, 60000); // Run every 60 seconds

    return () => clearInterval(intervalId);
  }, [settings.dailyDigestEnabled, settings.dailyDigestTime, settings.resendApiKey]);
  */

  async function loadDepartmentUsers() {
    try {
      const deptUsersRef = collection(db, 'departmentUsers');
      const snapshot = await getDocs(deptUsersRef);
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DepartmentUser));
      // Sort alphabetically
      users.sort((a, b) => a.username.localeCompare(b.username, 'tr'));
      setDepartmentUsers(users);
    } catch (error) {
      console.error('Error loading department users:', error);
    }
  }

  async function loadSettings() {
    try {
      const docRef = doc(db, 'reminderSettings', 'default');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          ...data,
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as ReminderSettings);
      }
    } catch (error) {
      console.error('Error loading reminder settings:', error);
    }
  }

  async function loadRecentLogs() {
    try {
      const logsRef = collection(db, 'reminderLogs');
      const q = query(logsRef, orderBy('sentAt', 'desc'), limit(10));
      const snapshot = await getDocs(q);

      const logs: ReminderLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        sentAt: doc.data().sentAt?.toDate() || new Date(),
      } as ReminderLog));

      setRecentLogs(logs);
    } catch (error) {
      console.error('Error loading reminder logs:', error);
    }
  }

  async function handleSaveSettings() {
    setIsSaving(true);
    setSaveMessage('');

    try {
      const docRef = doc(db, 'reminderSettings', 'default');
      await setDoc(docRef, {
        ...settings,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      setSaveMessage('Ayarlar kaydedildi! ✅');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('❌ Hata: Ayarlar kaydedilemedi');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendTestEmail() {
    if (!testEmail || !settings.resendApiKey) {
      setTestMessage('❌ Email adresi ve API key gerekli');
      return;
    }

    setIsTesting(true);
    setTestMessage('');

    try {
      const result = await sendTestEmail(settings.resendApiKey, testEmail);

      if (result.success) {
        setTestMessage('✅ Test email gönderildi!');
        loadRecentLogs(); // Refresh logs
      } else {
        setTestMessage(`❌ Hata: ${result.error}`);
      }

      setTimeout(() => setTestMessage(''), 5000);
    } catch (error) {
      console.error('Error sending test email:', error);
      setTestMessage('❌ Test email gönderilemedi');
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSendTestSMS() {
    if (!testPhone || !settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioPhoneNumber) {
      setTestSMSMessage('❌ Telefon numarası ve Twilio credentials gerekli');
      return;
    }

    setIsTestingSMS(true);
    setTestSMSMessage('');

    try {
      const result = await sendTestSMS(
        settings.twilioAccountSid,
        settings.twilioAuthToken,
        settings.twilioPhoneNumber,
        testPhone
      );

      if (result.success) {
        setTestSMSMessage('✅ Test SMS gönderildi!');
      } else {
        setTestSMSMessage(`❌ Hata: ${result.error}`);
      }

      setTimeout(() => setTestSMSMessage(''), 5000);
    } catch (error) {
      console.error('Error sending test SMS:', error);
      setTestSMSMessage('❌ Test SMS gönderilemedi');
    } finally {
      setIsTestingSMS(false);
    }
  }

  async function fetchPanelData() {
    // Fetch campaigns
    const campaignsRef = collection(db, 'events');
    const campaignsSnapshot = await getDocs(campaignsRef);
    const campaigns: CalendarEvent[] = campaignsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    } as CalendarEvent));

    // Fetch analytics tasks
    const analyticsRef = collection(db, 'analyticsTasks');
    const analyticsSnapshot = await getDocs(analyticsRef);
    const analyticsTasks: AnalyticsTask[] = analyticsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    } as AnalyticsTask));

    // Fetch reports
    const reportsRef = collection(db, 'reports');
    const reportsSnapshot = await getDocs(reportsRef);
    const reports: Report[] = reportsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    } as Report));

    // Fetch users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    const users: User[] = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as User));

    // Fetch analytics users
    const analyticsUsersRef = collection(db, 'analyticsUsers');
    const analyticsUsersSnapshot = await getDocs(analyticsUsersRef);
    const analyticsUsers: AnalyticsUser[] = analyticsUsersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as AnalyticsUser));

    // Fetch department users (for weekly digest)
    const deptUsersRef = collection(db, 'departmentUsers');
    const deptUsersSnapshot = await getDocs(deptUsersRef);
    const deptUsers = deptUsersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as DepartmentUser));

    return { campaigns, analyticsTasks, reports, users, analyticsUsers, deptUsers };
  }



  async function handleOpenDigestPreview() {
    setIsBuildingDigest(true);
    try {
      // 1. Fetch data
      const { campaigns, reports, users, deptUsers } = await fetchPanelData();

      // 2. Filter recipients (Selected designers)
      const selectedRecipients = deptUsers.filter(user => {
        const isSelected = (settings.emailCcRecipients || []).includes(user.id);
        return user.isDesigner && user.email && isSelected;
      });

      if (selectedRecipients.length === 0) {
        setProcessMessage('⚠️ Lütfen önce yukarıdan en az bir Designer seçin.');
        setTimeout(() => setProcessMessage(''), 4000);
        setIsBuildingDigest(false);
        return;
      }

      setDigestRecipients(selectedRecipients);

      // 3. Build digest content
      const digestContent = buildWeeklyDigest(reports, campaigns, users);

      // 4. Generate preview HTML (Generic preview)
      const previewHTML = buildWeeklyDigestHTML({
        recipientName: 'Sayın Tasarımcı',
        digestContent,
        weekStart: digestContent.weekStart,
        weekEnd: digestContent.weekEnd,
      });

      setDigestPreviewHTML(previewHTML);
      setDigestPreviewOpen(true);

    } catch (error) {
      console.error('Error building digest preview:', error);
      setProcessMessage('❌ Önizleme hazırlanırken bir hata oluştu.');
      setTimeout(() => setProcessMessage(''), 4000);
    } finally {
      setIsBuildingDigest(false);
    }

  }

  async function handleOpenDailyDigestPreview() {
    setIsBuildingDailyDigest(true);
    try {
      // 1. Fetch data
      const { campaigns, users, deptUsers } = await fetchPanelData();

      // 2. Filter recipients (Selected designers)
      const selectedRecipients = deptUsers.filter(user => {
        const isSelected = (settings.emailCcRecipients || []).includes(user.id);
        return user.isDesigner && user.email && isSelected;
      });

      if (selectedRecipients.length === 0) {
        setProcessMessage('⚠️ Lütfen önce yukarıdan en az bir Designer seçin.');
        setTimeout(() => setProcessMessage(''), 4000);
        setIsBuildingDailyDigest(false);
        return;
      }

      setDailyDigestRecipients(selectedRecipients);

      // 3. Build digest content
      const digestContent = buildDailyDigest(campaigns, users);

      // 4. Generate preview HTML
      const previewHTML = buildDailyDigestHTML({
        recipientName: 'Sayın Tasarımcı',
        digestContent,
      });

      setDailyDigestPreviewHTML(previewHTML);
      setDailyDigestPreviewOpen(true);

    } catch (error) {
      console.error('Error building daily digest preview:', error);
      setProcessMessage('❌ Önizleme hazırlanırken bir hata oluştu.');
      setTimeout(() => setProcessMessage(''), 4000);
    } finally {
      setIsBuildingDailyDigest(false);
    }
  }

  async function handleSendDailyDigestManually() {
    if (!settings.resendApiKey) {
      alert('API Key eksik!');
      return;
    }

    setIsSendingDailyDigest(true);
    let sentCount = 0;
    let failedCount = 0;

    try {
      const { campaigns, users } = await fetchPanelData();
      const digestContent = buildDailyDigest(campaigns, users);

      for (const recipient of dailyDigestRecipients) {
        try {
          const result = await sendDailyDigestEmail(
            settings.resendApiKey,
            recipient.email!,
            recipient.username,
            digestContent
          );

          if (result.success) {
            sentCount++;
          } else {
            console.error(`Failed to send to ${recipient.username}:`, result.error);
            failedCount++;
          }
        } catch (error) {
          console.error(`Error sending to ${recipient.username}:`, error);
          failedCount++;
        }
      }

      setDailyDigestPreviewOpen(false);
      setProcessMessage(`✅ Bülten gönderimi tamamlandı!\nGönderilen: ${sentCount}, Başarısız: ${failedCount}`);
      setTimeout(() => setProcessMessage(''), 8000);

    } catch (error) {
      console.error('Error sending digests:', error);
      alert('Gönderim sırasında hata oluştu.');
    } finally {
      setIsSendingDailyDigest(false);
    }
  }

  async function handleSendDigestManually() {
    if (!settings.resendApiKey) {
      alert('API Key eksik!');
      return;
    }

    setIsSendingDigest(true);
    let sentCount = 0;
    let failedCount = 0;

    try {
      // Re-fetch data to be sure (or reuse digest content if we stored it? Re-fetching is safer for real-time consistency but reusing content ensures what they saw is what they send.)
      // Actually, since we already built the content for preview, we could assume it's valid. 
      // But sendWeeklyDigestEmail builds HTML internally if we pass data. 
      // Let's re-fetch to be safe and consistent with processWeeklyDigest logic.
      const { campaigns, reports, users } = await fetchPanelData();
      const digestContent = buildWeeklyDigest(reports, campaigns, users);

      for (const recipient of digestRecipients) {
        try {
          const result = await sendWeeklyDigestEmail(
            settings.resendApiKey,
            recipient.email!,
            recipient.username,
            digestContent,
            digestContent.weekStart,
            digestContent.weekEnd
          );

          if (result.success) {
            sentCount++;
          } else {
            console.error(`Failed to send to ${recipient.username}:`, result.error);
            failedCount++;
          }
        } catch (error) {
          console.error(`Error sending to ${recipient.username}:`, error);
          failedCount++;
        }
      }

      setDigestPreviewOpen(false);
      setProcessMessage(`✅ Bülten gönderimi tamamlandı!\nGönderilen: ${sentCount}, Başarısız: ${failedCount}`);
      setTimeout(() => setProcessMessage(''), 8000);

    } catch (error) {
      console.error('Error sending digests:', error);
      alert('Gönderim sırasında hata oluştu.');
    } finally {
      setIsSendingDigest(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-slate-700">
        <Settings className="text-primary-700" size={24} />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Otomatik Hatırlatma Sistemi
        </h2>
      </div>

      {/* Main Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail size={20} className="text-primary-700" />
          Email Ayarları
        </h3>

        {/* Enable/Disable Toggle */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-md">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.isEnabled}
              onChange={(e) => setSettings({ ...settings, isEnabled: e.target.checked })}
              className="w-5 h-5 text-primary-700 rounded focus:ring-2 focus:ring-primary-200"
            />
            <div>
              <span className="font-medium text-gray-900 dark:text-white">
                Otomatik Hatırlatmaları Aktifleştir
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sistem otomatik olarak hatırlatma mailleri gönderecek
              </p>
              <div className="flex flex-col gap-1 mt-1">
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Hafta sonları (Cumartesi-Pazar) mail gönderilmez
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Check size={12} />
                  Sunucu (Cron) tarafından otomatik yönetilir. (Sayfayı açık tutmanıza gerek yok)
                </p>
              </div>
            </div>
          </label>
        </div>

        {/* Resend API Key */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Resend API Key
          </label>
          <input
            type="password"
            value={settings.resendApiKey || ''}
            onChange={(e) => setSettings({ ...settings, resendApiKey: e.target.value })}
            placeholder="re_xxxxxxxxxxxxxxxxxxxx"
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-primary-200 dark:bg-slate-700 dark:text-white"
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-700 hover:underline"
            >
              Resend.com
            </a>
            {' '}üzerinden ücretsiz API key alabilirsiniz (3,000 email/ay)
          </p>
        </div>

        {/* Reminder Rules */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Hatırlatma Kuralları (Gün)
          </label>
          <div className="grid grid-cols-2 gap-4">
            {(['Very High', 'High', 'Medium', 'Low'] as const).map((urgency) => (
              <div key={urgency} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400 w-24">
                  {urgency === 'Very High' ? 'Çok Yüksek' :
                    urgency === 'High' ? 'Yüksek' :
                      urgency === 'Medium' ? 'Orta' : 'Düşük'}:
                </span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.reminderRules[urgency]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      reminderRules: {
                        ...settings.reminderRules,
                        [urgency]: parseInt(e.target.value) || 1,
                      },
                    })
                  }
                  className="w-20 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-primary-200 dark:bg-slate-700 dark:text-white"
                />
                <span className="text-sm text-gray-500">gün sonra</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Görev atandıktan sonra belirtilen gün sayısı geçince hatırlatma gönderilir
          </p>
        </div>

        {/* Email Templates Section */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700/30 rounded-lg border border-gray-200 dark:border-slate-600">
          <h4 className="text-md font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <FileText size={18} className="text-primary-700" />
            Email Şablon Düzenleyici
          </h4>

          {/* Subject Template */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Konu Satırı
            </label>
            <input
              type="text"
              value={settings.emailSubjectTemplate}
              onChange={(e) => setSettings({ ...settings, emailSubjectTemplate: e.target.value })}
              placeholder="⏰ Hatırlatma: {title}"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-primary-200 dark:bg-slate-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Değişkenler: <code className="bg-gray-200 dark:bg-slate-600 px-1 rounded">{'{title}'}</code>, <code className="bg-gray-200 dark:bg-slate-600 px-1 rounded">{'{urgency}'}</code>, <code className="bg-gray-200 dark:bg-slate-600 px-1 rounded">{'{days}'}</code>
            </p>
          </div>

          {/* Body Template */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email İçeriği (Metin)
            </label>
            <textarea
              value={settings.emailBodyTemplate}
              onChange={(e) => setSettings({ ...settings, emailBodyTemplate: e.target.value })}
              placeholder="Merhaba {assignee},&#10;&#10;{title} görevi üzerinden {days} gün geçti. Lütfen durumu kontrol edin."
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-primary-200 dark:bg-slate-700 dark:text-white font-mono"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Kullanılabilir değişkenler:
              <code className="bg-gray-200 dark:bg-slate-600 px-1 rounded ml-1">{'{assignee}'}</code>
              <code className="bg-gray-200 dark:bg-slate-600 px-1 rounded ml-1">{'{title}'}</code>
              <code className="bg-gray-200 dark:bg-slate-600 px-1 rounded ml-1">{'{urgency}'}</code>
              <code className="bg-gray-200 dark:bg-slate-600 px-1 rounded ml-1">{'{days}'}</code>
              <code className="bg-gray-200 dark:bg-slate-600 px-1 rounded ml-1">{'{eventType}'}</code>
            </p>
          </div>

          {/* Preview Example */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-1">
              <Eye size={14} />
              Örnek Önizleme:
            </p>
            <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <p><strong>Konu:</strong> {settings.emailSubjectTemplate.replace('{title}', 'Yaz Kampanyası').replace('{urgency}', 'Yüksek').replace('{days}', '2')}</p>
              <p className="mt-2"><strong>İçerik:</strong></p>
              <p className="whitespace-pre-wrap bg-white dark:bg-slate-800 p-2 rounded border border-blue-200 dark:border-blue-700">
                {settings.emailBodyTemplate
                  .replace('{assignee}', 'Ahmet Yılmaz')
                  .replace('{title}', 'Yaz Kampanyası')
                  .replace('{urgency}', 'Yüksek')
                  .replace('{days}', '2')
                  .replace('{eventType}', 'Kampanya')}
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-6 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={18} />
            {isSaving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
          </button>
          {saveMessage && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {saveMessage}
            </span>
          )}
        </div>
      </div>

      {/* Report Delay Notifications Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText size={20} className="text-red-600" />
          Rapor Gecikme Bildirimleri
        </h3>

        {/* Enable/Disable Toggle */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-md">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.reportDelayNotificationsEnabled || false}
              onChange={(e) => setSettings({ ...settings, reportDelayNotificationsEnabled: e.target.checked })}
              className="w-5 h-5 text-red-600 rounded focus:ring-2 focus:ring-red-200"
            />
            <div>
              <span className="font-medium text-gray-900 dark:text-white">
                Rapor Gecikme Bildirimlerini Aktifleştir
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Teslim tarihi geçmiş raporlar için otomatik e-mail gönder
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                Hafta sonları (Cumartesi-Pazar) mail gönderilmez
              </p>
            </div>
          </label>
        </div>

        {/* Threshold Setting */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gecikme Eşiği (Gün)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="30"
              value={settings.reportDelayThresholdDays || 0}
              onChange={(e) => setSettings({ ...settings, reportDelayThresholdDays: parseInt(e.target.value) || 0 })}
              className="w-24 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-red-200 dark:bg-slate-700 dark:text-white"
              disabled={!settings.reportDelayNotificationsEnabled}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              gün gecikmeden sonra bildirim gönder
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {settings.reportDelayThresholdDays === 0
              ? '⚡ Anında gönder: Rapor teslim tarihi geçer geçmez bildirim gönderilir'
              : `⏱️ Rapor teslim tarihinden ${settings.reportDelayThresholdDays} gün sonra bildirim gönderilir`}
          </p>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-900 dark:text-blue-200 mb-2 font-medium">
            📧 Nasıl Çalışır?
          </p>
          <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>Sadece "pending" (bekleyen) durumdaki raporlar kontrol edilir</li>
            <li>Teslim tarihi geçmiş raporlar tespit edilir</li>
            <li>Atanan kişiye otomatik e-mail gönderilir</li>
            <li>Her rapor için 24 saatte bir kez bildirim gönderilir (spam önleme)</li>
            <li>Manuel kontrol butonuyla test edebilirsiniz</li>
          </ul>
        </div>
      </div>

      {/* Weekly Digest Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail size={20} className="text-purple-600" />
          Haftalık Bülten
        </h3>

        {/* Enable/Disable Toggle */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-md">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.weeklyDigestEnabled || false}
              onChange={(e) => setSettings({ ...settings, weeklyDigestEnabled: e.target.checked })}
              className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-200"
            />
            <div>
              <span className="font-medium text-gray-900 dark:text-white">
                Haftalık Bülteni Aktifleştir
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Seçilen Designer kullanıcılarına haftalık özet maili gönder
              </p>
            </div>
          </label>
        </div>

        {/* Schedule Configuration */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Gün
            </label>
            <select
              value={settings.weeklyDigestDay || 1}
              onChange={(e) => setSettings({ ...settings, weeklyDigestDay: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-purple-200 dark:bg-slate-700 dark:text-white"
              disabled={!settings.weeklyDigestEnabled}
            >
              <option value={1}>Pazartesi</option>
              <option value={2}>Salı</option>
              <option value={3}>Çarşamba</option>
              <option value={4}>Perşembe</option>
              <option value={5}>Cuma</option>
              <option value={6}>Cumartesi</option>
              <option value={7}>Pazar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Saat (HH:mm)
            </label>
            <input
              type="time"
              value={settings.weeklyDigestTime || '09:00'}
              onChange={(e) => setSettings({ ...settings, weeklyDigestTime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-purple-200 dark:bg-slate-700 dark:text-white"
              disabled={!settings.weeklyDigestEnabled}
            />
          </div>
        </div>

        {/* Content Options */}
        <div className="mb-6 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.weeklyDigestIncludeOverdueReports ?? true}
              onChange={(e) => setSettings({ ...settings, weeklyDigestIncludeOverdueReports: e.target.checked })}
              className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-200"
              disabled={!settings.weeklyDigestEnabled}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Gecikmiş raporları dahil et
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.weeklyDigestIncludeThisWeekCampaigns ?? true}
              onChange={(e) => setSettings({ ...settings, weeklyDigestIncludeThisWeekCampaigns: e.target.checked })}
              className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-200"
              disabled={!settings.weeklyDigestEnabled}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Bu haftanın kampanyalarını dahil et
            </span>
          </label>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md mb-6">
          <p className="text-sm text-blue-900 dark:text-blue-200 mb-2 font-medium">
            📧 Bilgilendirme
          </p>
          <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>Sadece aşağıda seçilen Designer kullanıcılarına gönderilir</li>
            <li>Gecikmiş raporlar ve bu haftanın kampanyaları listelenir</li>
            <li>Hafta aralığı: Pazartesi - Pazar</li>
            <li>Manuel test butonu ile önizleyebilirsiniz</li>
          </ul>
        </div>

        {/* Manual Trigger Button */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={handleOpenDigestPreview}
            disabled={isBuildingDigest || !settings.resendApiKey}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
          >
            {isBuildingDigest ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Hazırlanıyor...
              </>
            ) : (
              <>
                <Send size={16} />
                Manuel Bülten Gönder
              </>
            )}
          </button>
        </div>

        {/* Daily Digest Section */}
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
          <Mail size={20} className="text-green-600" />
          Gün Sonu Bülteni
        </h3>

        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md mb-6">
          <p className="text-sm text-green-900 dark:text-green-200 mb-2 font-medium">
            🌅 Gün Sonu Özeti
          </p>
          <ul className="text-xs text-green-800 dark:text-green-300 space-y-1 list-disc list-inside">
            <li>Bugünün tamamlanan ve bekleyen kampanyalarını içerir</li>
            <li>Sadece seçilen Designer kullanıcılarına gönderilir</li>
            <li>Otomatik ayarlanırsa her gün belirlenen saatte gönderilir</li>
          </ul>

          {/* Automatic Scheduling Options */}
          <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dailyDigestEnabled || false}
                onChange={(e) => setSettings({ ...settings, dailyDigestEnabled: e.target.checked })}
                className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-200"
              />
              <span className="text-sm font-medium text-green-900 dark:text-green-100">
                Otomatik Gönderimi Aktifleştir
              </span>
            </label>

            <div className="flex items-center gap-2">
              <label className="text-sm text-green-800 dark:text-green-200">
                Gönderim Saati:
              </label>
              <input
                type="time"
                value={settings.dailyDigestTime || '17:00'}
                onChange={(e) => setSettings({ ...settings, dailyDigestTime: e.target.value })}
                className="px-2 py-1 border border-green-300 dark:border-green-700 rounded text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white"
                disabled={!settings.dailyDigestEnabled}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleOpenDailyDigestPreview}
              disabled={isBuildingDailyDigest}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isBuildingDailyDigest ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Hazırlanıyor...
                </>
              ) : (
                <>
                  <Eye size={16} />
                  Gün Sonu Bülteni Önizle
                </>
              )}
            </button>
          </div>
        </div>

        {/* CC Recipients Section */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <Users size={18} className="text-purple-600" />
            <h4 className="font-medium text-gray-800 dark:text-gray-200">
              Email CC Alıcıları
            </h4>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Listelenen Designer kullanıcılarını seçerek tüm email bildirimlerine CC olarak ekleyebilirsiniz.
          </p>

          {departmentUsers.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Yükleniyor...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 dark:bg-slate-700/50 rounded-md">
              {departmentUsers
                .filter(user => user.isDesigner)
                .map(user => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={(settings.emailCcRecipients || []).includes(user.id)}
                      onChange={(e) => {
                        const currentCc = settings.emailCcRecipients || [];
                        if (e.target.checked) {
                          setSettings({ ...settings, emailCcRecipients: [...currentCc, user.id] });
                        } else {
                          setSettings({ ...settings, emailCcRecipients: currentCc.filter(id => id !== user.id) });
                        }
                      }}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-200"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-800 dark:text-gray-200 block truncate">
                        {user.username}
                        {user.isDesigner && (
                          <span className="ml-1 text-xs text-purple-600 dark:text-purple-400">(Designer)</span>
                        )}
                      </span>
                      {user.email && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">{user.email}</span>
                      )}
                    </div>
                  </label>
                ))}
            </div>
          )}

          {(settings.emailCcRecipients?.length || 0) > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {settings.emailCcRecipients?.length} kullanıcı seçildi
            </p>
          )}
        </div>



      </div>

      {/* Twilio SMS Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Smartphone size={20} className="text-green-700" />
              SMS Bildirimleri (Twilio)
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Kampanya ataması yapıldığında SMS gönderimi
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.twilioEnabled || false}
              onChange={(e) => setSettings({ ...settings, twilioEnabled: e.target.checked })}
              className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-200"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              SMS Aktif
            </span>
          </label>
        </div>

        {settings.twilioEnabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account SID
              </label>
              <input
                type="text"
                value={settings.twilioAccountSid || ''}
                onChange={(e) => setSettings({ ...settings, twilioAccountSid: e.target.value })}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Auth Token
              </label>
              <input
                type="password"
                value={settings.twilioAuthToken || ''}
                onChange={(e) => setSettings({ ...settings, twilioAuthToken: e.target.value })}
                placeholder="••••••••••••••••••••••••••••••••"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Twilio Phone Number
              </label>
              <input
                type="text"
                value={settings.twilioPhoneNumber || ''}
                onChange={(e) => setSettings({ ...settings, twilioPhoneNumber: e.target.value })}
                placeholder="+90xxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Twilio'dan aldığınız telefon numarası (+ ile başlamalı)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SMS Şablonu
              </label>
              <textarea
                value={settings.smsTemplate || ''}
                onChange={(e) => setSettings({ ...settings, smsTemplate: e.target.value })}
                rows={3}
                placeholder="{title} görevi size atandı. Kampanya Takvimi"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white font-mono"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Değişkenler: <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">{'{title}'}</code>,{' '}
                <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">{'{assignee}'}</code>,{' '}
                <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">{'{urgency}'}</code>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Test SMS Section */}
      {settings.twilioEnabled && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Smartphone size={20} className="text-green-700" />
            Test SMS Gönder
          </h3>

          <div className="flex gap-3">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+905xxxxxxxxx"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white"
            />
            <button
              onClick={handleSendTestSMS}
              disabled={isTestingSMS || !settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioPhoneNumber}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Smartphone size={18} />
              {isTestingSMS ? 'Gönderiliyor...' : 'Test Gönder'}
            </button>
          </div>

          {testSMSMessage && (
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {testSMSMessage}
            </div>
          )}
        </div>
      )}

      {/* Test Email Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Send size={20} className="text-primary-700" />
          Test Email Gönder
        </h3>

        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-primary-200 dark:bg-slate-700 dark:text-white"
          />
          <button
            onClick={handleSendTestEmail}
            disabled={isTesting || !settings.resendApiKey}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={18} />
            {isTesting ? 'Gönderiliyor...' : 'Test Gönder'}
          </button>
        </div>

        {testMessage && (
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {testMessage}
          </div>
        )}
      </div>



      {/* Recent Logs */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Son Gönderilen Mailler</h3>
          <button
            onClick={loadRecentLogs}
            className="text-sm text-primary-700 hover:text-primary-800 flex items-center gap-1"
          >
            🔄 Yenile
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="text-center py-8">
            <Mail size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Henüz mail gönderilmemiş
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Test email gönderin veya manuel kontrol yapın
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-center justify-between p-3 rounded-md border ${log.status === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {log.eventTitle}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${log.eventType === 'campaign'
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                      {log.eventType === 'campaign' ? '📅 Kampanya' : '📈 Analitik'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    📧 {log.recipientName} ({log.recipientEmail})
                  </p>
                  {log.errorMessage && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      ❌ Hata: {log.errorMessage}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {log.sentAt.toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {log.sentAt.toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {log.status === 'success' ? (
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full">
                      <Check size={18} className="text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full">
                      <X size={18} className="text-red-600 dark:text-red-400" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Digest Preview Modal */}
      {digestPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="text-purple-600" size={20} />
                Haftalık Bülten Önizleme ve Gönderim
              </h3>
              <button
                onClick={() => setDigestPreviewOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Recipients List */}
              <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-700 p-4 overflow-y-auto bg-gray-50 dark:bg-slate-900/50">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Users size={16} />
                  Alıcılar ({digestRecipients.length})
                </h4>
                <div className="space-y-2">
                  {digestRecipients.map(user => (
                    <div key={user.id} className="text-xs p-2 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700">
                      <div className="font-medium text-gray-900 dark:text-white">{user.username}</div>
                      <div className="text-gray-500 dark:text-gray-400">{user.email}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Email Preview */}
              <div className="w-full md:w-2/3 p-4 overflow-y-auto bg-white dark:bg-slate-800">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Eye size={16} />
                  Email İçeriği (Önizleme)
                </h4>
                <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden h-[400px]">
                  <iframe
                    srcDoc={digestPreviewHTML}
                    title="Digest Preview"
                    className="w-full h-full bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-800">
              <button
                onClick={() => setDigestPreviewOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md font-medium transition-colors"
                disabled={isSendingDigest}
              >
                İptal
              </button>
              <button
                onClick={handleSendDigestManually}
                disabled={isSendingDigest}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSendingDigest ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Onayla ve Gönder
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Daily Digest Preview Modal */}
      {dailyDigestPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye size={20} className="text-green-600" />
                Gün Sonu Bülteni Önizleme
              </h3>
              <button
                onClick={() => setDailyDigestPreviewOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Alıcılar ({dailyDigestRecipients.length}):</strong> {dailyDigestRecipients.map(u => u.username).join(', ')}
              </p>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-slate-900">
              <div className="bg-white rounded shadow-lg mx-auto max-w-2xl" dangerouslySetInnerHTML={{ __html: dailyDigestPreviewHTML }} />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-800/50 rounded-b-xl">
              <button
                onClick={() => setDailyDigestPreviewOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md font-medium transition-colors"
              >
                Kapat
              </button>
              <button
                onClick={handleSendDailyDigestManually}
                disabled={isSendingDailyDigest}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSendingDailyDigest ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Onayla ve Gönder
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
