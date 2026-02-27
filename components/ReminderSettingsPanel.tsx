import React, { useState, useEffect } from 'react';
import { Save, Send, Check, X, AlertCircle, Mail, Settings, Eye, Smartphone, Users, FileText, Clock, Bell, TestTube, BarChart3, UserCircle } from 'lucide-react';
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
  collection
} from 'firebase/firestore';
import { sendTestEmail } from '../utils/emailService';
import { sendTestSMS } from '../utils/smsService';
import { saveReminderLog } from '../utils/reminderHelper';

import { buildWeeklyDigest } from '../utils/weeklyDigestBuilder';
import { buildWeeklyDigestHTML, sendWeeklyDigestEmail, buildDailyDigestHTML, sendDailyDigestEmail, buildAnalyticsBulletinHTML, sendAnalyticsBulletinEmail, buildPersonalBulletinHTML, sendPersonalBulletinEmail, buildMorningBulletinHTML, sendMorningBulletinEmail } from '../utils/emailService';
import { buildDailyDigest } from '../utils/dailyDigestBuilder';
import { buildAnalyticsBulletin } from '../utils/analyticsBulletinBuilder';

type TabType = 'general' | 'reminders' | 'digests' | 'reports' | 'testing' | 'logs';

export default function ReminderSettingsPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('general');
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

  const [analyticsBulletinPreviewOpen, setAnalyticsBulletinPreviewOpen] = useState(false);
  const [analyticsBulletinPreviewHTML, setAnalyticsBulletinPreviewHTML] = useState('');
  const [isBuildingAnalyticsBulletin, setIsBuildingAnalyticsBulletin] = useState(false);
  const [isSendingAnalyticsBulletin, setIsSendingAnalyticsBulletin] = useState(false);
  const [analyticsBulletinRecipients, setAnalyticsBulletinRecipients] = useState<AnalyticsUser[]>([]);

  const [analyticsUsers, setAnalyticsUsers] = useState<AnalyticsUser[]>([]);

  // Morning Bulletin states
  const [morningBulletinPreviewOpen, setMorningBulletinPreviewOpen] = useState(false);
  const [morningBulletinPreviewHTML, setMorningBulletinPreviewHTML] = useState('');
  const [isBuildingMorningBulletin, setIsBuildingMorningBulletin] = useState(false);
  const [isSendingMorningBulletin, setIsSendingMorningBulletin] = useState(false);
  const [morningBulletinRecipients, setMorningBulletinRecipients] = useState<DepartmentUser[]>([]);

  // Personal Daily Bulletin states
  const [users, setUsers] = useState<User[]>([]);
  const [personalBulletinPreviewOpen, setPersonalBulletinPreviewOpen] = useState(false);
  const [personalBulletinPreviewHTML, setPersonalBulletinPreviewHTML] = useState('');
  const [isBuildingPersonalBulletin, setIsBuildingPersonalBulletin] = useState(false);
  const [isSendingPersonalBulletin, setIsSendingPersonalBulletin] = useState(false);
  const [personalBulletinRecipients, setPersonalBulletinRecipients] = useState<User[]>([]);

  const [saveMessage, setSaveMessage] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testSMSMessage, setTestSMSMessage] = useState('');
  const [processMessage, setProcessMessage] = useState('');

  const dedupeOverdueReports = <T extends { title?: string; campaignTitle?: string; dueDate: Date }>(items: T[]): T[] => {
    const seen = new Set<string>();
    const unique: T[] = [];

    for (const item of items) {
      const normalizedTitle = (item.title || '').trim().toLocaleLowerCase('tr-TR');
      const normalizedCampaign = (item.campaignTitle || '').trim().toLocaleLowerCase('tr-TR');
      const dueDateKey = `${item.dueDate.getFullYear()}-${item.dueDate.getMonth() + 1}-${item.dueDate.getDate()}`;
      const key = `${normalizedTitle}|${normalizedCampaign}|${dueDateKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }

    return unique;
  };

  useEffect(() => {
    loadSettings();
    loadRecentLogs();
    loadDepartmentUsers();
    loadAnalyticsUsers();
    loadUsers();
  }, []);

  async function loadDepartmentUsers() {
    try {
      const deptUsersRef = collection(db, 'departmentUsers');
      const snapshot = await getDocs(deptUsersRef);
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DepartmentUser));
      users.sort((a, b) => a.username.localeCompare(b.username, 'tr'));
      setDepartmentUsers(users);
    } catch (error) {
      console.error('Error loading department users:', error);
    }
  }

  async function loadAnalyticsUsers() {
    try {
      const analyticsUsersRef = collection(db, 'analyticsUsers');
      const snapshot = await getDocs(analyticsUsersRef);
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AnalyticsUser));
      users.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      setAnalyticsUsers(users);
    } catch (error) {
      console.error('Error loading analytics users:', error);
    }
  }

  async function loadUsers() {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));
      usersList.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      setUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
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

      console.log('Loading recent logs, found:', snapshot.docs.length);

      const logs: ReminderLog[] = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Log entry:', {
          id: doc.id,
          eventTitle: data.eventTitle,
          sentAt: data.sentAt,
        });
        return {
          id: doc.id,
          ...data,
          sentAt: data.sentAt?.toDate() || new Date(),
        } as ReminderLog;
      });

      setRecentLogs(logs);
      console.log('Recent logs loaded successfully:', logs.length);
    } catch (error) {
      console.error('Error loading reminder logs:', error);
      setProcessMessage('❌ Log yükleme hatası: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
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

      setSaveMessage('✅ Ayarlar başarıyla kaydedildi!');
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

      // Log to Firestore
      try {
        console.log('Saving test email log to Firestore...');
        const logData: any = {
          eventId: 'test-email-' + Date.now(),
          eventType: 'campaign',
          eventTitle: '🧪 Test Email',
          recipientEmail: testEmail,
          recipientName: 'Test Kullanıcı',
          urgency: 'High',
          sentAt: new Date(),
          status: result.success ? 'success' : 'failed',
          emailProvider: 'resend',
        };

        // Only add optional fields if they have values
        if (result.error) {
          logData.errorMessage = result.error;
        }
        if (result.messageId) {
          logData.messageId = result.messageId;
        }

        await saveReminderLog(logData);
        console.log('Test email log saved successfully');
      } catch (logError) {
        console.error('Error saving test email log:', logError);
      }

      if (result.success) {
        setTestMessage('✅ Test email gönderildi!');
        // Reload logs after a short delay to ensure Firestore has processed
        setTimeout(() => loadRecentLogs(), 1000);
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
    const campaignsRef = collection(db, 'events');
    const campaignsSnapshot = await getDocs(campaignsRef);
    const campaigns: CalendarEvent[] = campaignsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    } as CalendarEvent));

    const analyticsRef = collection(db, 'analyticsTasks');
    const analyticsSnapshot = await getDocs(analyticsRef);
    const analyticsTasks: AnalyticsTask[] = analyticsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    } as AnalyticsTask));

    const reportsRef = collection(db, 'reports');
    const reportsSnapshot = await getDocs(reportsRef);
    const reports: Report[] = reportsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    } as Report));

    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    const users: User[] = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as User));

    const analyticsUsersRef = collection(db, 'analyticsUsers');
    const analyticsUsersSnapshot = await getDocs(analyticsUsersRef);
    const analyticsUsers: AnalyticsUser[] = analyticsUsersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as AnalyticsUser));

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
      const { campaigns, reports, users, deptUsers } = await fetchPanelData();

      const selectedRecipients = deptUsers.filter(user => {
        const isSelected = (settings.emailCcRecipients || []).includes(user.id);
        return user.isDesigner && user.email && isSelected;
      });

      if (selectedRecipients.length === 0) {
        setProcessMessage('⚠️ Lütfen önce "Alıcılar" sekmesinden en az bir Designer seçin.');
        setTimeout(() => setProcessMessage(''), 4000);
        setIsBuildingDigest(false);
        return;
      }

      setDigestRecipients(selectedRecipients);

      const digestContent = buildWeeklyDigest(reports, campaigns, users);

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
      const { campaigns, users, deptUsers } = await fetchPanelData();

      const selectedRecipients = deptUsers.filter(user => {
        const isSelected = (settings.emailCcRecipients || []).includes(user.id);
        return user.isDesigner && user.email && isSelected;
      });

      if (selectedRecipients.length === 0) {
        setProcessMessage('⚠️ Lütfen önce "Alıcılar" sekmesinden en az bir Designer seçin.');
        setTimeout(() => setProcessMessage(''), 4000);
        setIsBuildingDailyDigest(false);
        return;
      }

      setDailyDigestRecipients(selectedRecipients);

      const digestContent = buildDailyDigest(campaigns, users);

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

          // Log to Firestore
          try {
            const logData: any = {
              eventId: `daily-digest-${new Date().toISOString().split('T')[0]}-${recipient.id}`,
              eventType: 'campaign',
              eventTitle: '📅 Gün Sonu Bülteni',
              recipientEmail: recipient.email!,
              recipientName: recipient.username,
              urgency: 'Medium',
              sentAt: new Date(),
              status: result.success ? 'success' : 'failed',
              emailProvider: 'resend',
            };

            // Only add optional fields if they have values
            if (result.error) {
              logData.errorMessage = result.error;
            }
            if (result.messageId) {
              logData.messageId = result.messageId;
            }

            await saveReminderLog(logData);
            console.log('Daily digest log saved for:', recipient.username);
          } catch (logError) {
            console.error('Error saving daily digest log:', logError);
          }

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

      // Reload logs after a short delay
      setTimeout(() => {
        loadRecentLogs();
        setProcessMessage('');
      }, 2000);

    } catch (error) {
      console.error('Error sending digests:', error);
      alert('Gönderim sırasında hata oluştu.');
    } finally {
      setIsSendingDailyDigest(false);
    }
  }

  async function handleOpenAnalyticsBulletinPreview() {
    setIsBuildingAnalyticsBulletin(true);
    try {
      const { analyticsTasks } = await fetchPanelData();

      const selectedRecipients = analyticsUsers.filter(user => {
        const isSelected = (settings.analyticsDailyBulletinRecipients || []).includes(user.id);
        return user.email && isSelected;
      });

      if (selectedRecipients.length === 0) {
        setProcessMessage('⚠️ Lütfen önce analitik bülten alıcılarını seçin.');
        setTimeout(() => setProcessMessage(''), 4000);
        setIsBuildingAnalyticsBulletin(false);
        return;
      }

      setAnalyticsBulletinRecipients(selectedRecipients);

      // Build bulletin for first recipient as preview
      const firstRecipient = selectedRecipients[0];

      // Build bulletin content
      const bulletinContent = buildAnalyticsBulletin(
        analyticsTasks,
        firstRecipient.id
      );

      const previewHTML = buildAnalyticsBulletinHTML({
        recipientName: firstRecipient.name,
        analyticsTasks: bulletinContent.analyticsTasks,
        date: bulletinContent.date,
        totalCount: bulletinContent.totalCount
      });

      setAnalyticsBulletinPreviewHTML(previewHTML);
      setAnalyticsBulletinPreviewOpen(true);

    } catch (error) {
      console.error('Error building analytics bulletin preview:', error);
      setProcessMessage('❌ Önizleme hazırlanırken bir hata oluştu.');
      setTimeout(() => setProcessMessage(''), 4000);
    } finally {
      setIsBuildingAnalyticsBulletin(false);
    }
  }

  async function handleSendAnalyticsBulletinManually() {
    if (!settings.resendApiKey) {
      alert('API Key eksik!');
      return;
    }

    setIsSendingAnalyticsBulletin(true);
    let sentCount = 0;
    let failedCount = 0;

    try {
      const { analyticsTasks } = await fetchPanelData();

      for (const recipient of analyticsBulletinRecipients) {
        try {
          const bulletinContent = buildAnalyticsBulletin(
            analyticsTasks,
            recipient.id
          );

          const result = await sendAnalyticsBulletinEmail(
            settings.resendApiKey,
            recipient.email!,
            recipient.name,
            bulletinContent
          );

          // Log to Firestore
          try {
            const logData: any = {
              eventId: `analytics-bulletin-${new Date().toISOString().split('T')[0]}-${recipient.id}`,
              eventType: 'analytics',
              eventTitle: '📈 Analitik Günlük Bülten',
              recipientEmail: recipient.email!,
              recipientName: recipient.name,
              urgency: 'Medium',
              sentAt: new Date(),
              status: result.success ? 'success' : 'failed',
              emailProvider: 'resend',
            };

            if (result.error) {
              logData.errorMessage = result.error;
            }
            if (result.messageId) {
              logData.messageId = result.messageId;
            }

            await saveReminderLog(logData);
            console.log('Analytics bulletin log saved for:', recipient.name);
          } catch (logError) {
            console.error('Error saving analytics bulletin log:', logError);
          }

          if (result.success) {
            sentCount++;
          } else {
            console.error(`Failed to send to ${recipient.name}:`, result.error);
            failedCount++;
          }
        } catch (error) {
          console.error(`Error sending to ${recipient.name}:`, error);
          failedCount++;
        }
      }

      setAnalyticsBulletinPreviewOpen(false);
      setProcessMessage(`✅ Analitik bülten gönderimi tamamlandı!\nGönderilen: ${sentCount}, Başarısız: ${failedCount}`);

      // Reload logs after a short delay
      setTimeout(() => {
        loadRecentLogs();
        setProcessMessage('');
      }, 2000);

    } catch (error) {
      console.error('Error sending analytics bulletins:', error);
      alert('Gönderim sırasında hata oluştu.');
    } finally {
      setIsSendingAnalyticsBulletin(false);
    }
  }

  async function handleOpenMorningBulletinPreview() {
    setIsBuildingMorningBulletin(true);
    try {
      // Günsonu bültetiyle aynı mantık: emailCcRecipients + isDesigner
      const selectedRecipients = departmentUsers.filter(u => {
        const isSelected = (settings.emailCcRecipients || []).includes(u.id);
        return u.isDesigner && u.email && isSelected;
      });

      if (selectedRecipients.length === 0) {
        setProcessMessage('⚠️ Bülten Alıcıları bölümünden en az bir tasarımcı seçin.');
        setTimeout(() => setProcessMessage(''), 4000);
        setIsBuildingMorningBulletin(false);
        return;
      }

      setMorningBulletinRecipients(selectedRecipients);

      const { campaigns, users: allUsers } = await fetchPanelData();
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const weekEnd = new Date(todayStart.getTime() + 8 * 24 * 60 * 60 * 1000);

      const getUserName = (assigneeId?: string) => {
        if (!assigneeId) return 'Atanmamış';
        const u = allUsers.find((u: any) => u.id === assigneeId);
        return (u as any)?.name || 'Bilinmiyor';
      };

      const overdueCampaigns = campaigns
        .filter(c => {
          const d = new Date(c.date.getFullYear(), c.date.getMonth(), c.date.getDate());
          return d < todayStart && c.status !== 'İptal Edildi' && c.status !== 'Tamamlandı';
        })
        .map(c => ({ title: c.title, assigneeName: getUserName(c.assigneeId), date: c.date, urgency: c.urgency }));

      const todayCampaigns = campaigns
        .filter(c => {
          const d = new Date(c.date.getFullYear(), c.date.getMonth(), c.date.getDate());
          return d.getTime() === todayStart.getTime() && c.status !== 'İptal Edildi';
        })
        .map(c => ({ title: c.title, assigneeName: getUserName(c.assigneeId), urgency: c.urgency, status: c.status || 'Planlandı' }));

      const upcomingCampaigns = campaigns
        .filter(c => {
          const d = new Date(c.date.getFullYear(), c.date.getMonth(), c.date.getDate());
          return d >= tomorrowStart && d < weekEnd && c.status !== 'İptal Edildi' && c.status !== 'Tamamlandı';
        })
        .map(c => ({ title: c.title, assigneeName: getUserName(c.assigneeId), date: c.date, urgency: c.urgency }));

      const dateStr = today.toLocaleDateString('tr-TR', {
        day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
      });

      const previewHTML = buildMorningBulletinHTML({
        recipientName: selectedRecipients[0].username,
        overdueCampaigns,
        todayCampaigns,
        upcomingCampaigns,
        dateStr,
      });

      setMorningBulletinPreviewHTML(previewHTML);
      setMorningBulletinPreviewOpen(true);
    } catch (error) {
      console.error('Error building morning bulletin preview:', error);
      setProcessMessage('❌ Önizleme hazırlanırken bir hata oluştu.');
      setTimeout(() => setProcessMessage(''), 4000);
    } finally {
      setIsBuildingMorningBulletin(false);
    }
  }

  async function handleSendMorningBulletinManually() {
    if (!settings.resendApiKey) {
      alert('API Key eksik!');
      return;
    }

    setIsSendingMorningBulletin(true);
    let sentCount = 0;
    let failedCount = 0;

    try {
      const { campaigns, users: allUsers } = await fetchPanelData();
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const weekEnd = new Date(todayStart.getTime() + 8 * 24 * 60 * 60 * 1000);

      const getUserName = (assigneeId?: string) => {
        if (!assigneeId) return 'Atanmamış';
        const u = allUsers.find((u: any) => u.id === assigneeId);
        return (u as any)?.name || 'Bilinmiyor';
      };

      const overdueCampaigns = campaigns
        .filter(c => {
          const d = new Date(c.date.getFullYear(), c.date.getMonth(), c.date.getDate());
          return d < todayStart && c.status !== 'İptal Edildi' && c.status !== 'Tamamlandı';
        })
        .map(c => ({ title: c.title, assigneeName: getUserName(c.assigneeId), date: c.date, urgency: c.urgency }));

      const todayCampaigns = campaigns
        .filter(c => {
          const d = new Date(c.date.getFullYear(), c.date.getMonth(), c.date.getDate());
          return d.getTime() === todayStart.getTime() && c.status !== 'İptal Edildi';
        })
        .map(c => ({ title: c.title, assigneeName: getUserName(c.assigneeId), urgency: c.urgency, status: c.status || 'Planlandı' }));

      const upcomingCampaigns = campaigns
        .filter(c => {
          const d = new Date(c.date.getFullYear(), c.date.getMonth(), c.date.getDate());
          return d >= tomorrowStart && d < weekEnd && c.status !== 'İptal Edildi' && c.status !== 'Tamamlandı';
        })
        .map(c => ({ title: c.title, assigneeName: getUserName(c.assigneeId), date: c.date, urgency: c.urgency }));

      const dateStr = today.toLocaleDateString('tr-TR');

      for (const recipient of morningBulletinRecipients) {
        try {
          setProcessMessage(`📧 Gönderiliyor: ${recipient.username} (${sentCount + failedCount + 1}/${morningBulletinRecipients.length})...`);

          const result = await sendMorningBulletinEmail(
            settings.resendApiKey,
            recipient.email!,
            recipient.username,
            overdueCampaigns,
            todayCampaigns,
            upcomingCampaigns,
            dateStr
          );

          try {
            const logData: any = {
              eventId: `morning-bulletin-${new Date().toISOString().split('T')[0]}-${recipient.id}`,
              eventType: 'campaign',
              eventTitle: '🌄 Sabah Bülteni',
              recipientEmail: recipient.email!,
              recipientName: recipient.username,
              urgency: 'Medium',
              sentAt: new Date(),
              status: result.success ? 'success' : 'failed',
              emailProvider: 'resend',
            };
            if (result.error) logData.errorMessage = result.error;
            if (result.messageId) logData.messageId = result.messageId;
            await saveReminderLog(logData);
          } catch (logError) {
            console.error('Error saving morning bulletin log:', logError);
          }

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

      setMorningBulletinPreviewOpen(false);
      setProcessMessage(`✅ Bülten gönderimi tamamlandı!\nGönderilen: ${sentCount}, Başarısız: ${failedCount}`);
      setTimeout(() => { loadRecentLogs(); setProcessMessage(''); }, 2000);
    } catch (error) {
      console.error('Error sending morning bulletins:', error);
      alert('Gönderim sırasında hata oluştu.');
    } finally {
      setIsSendingMorningBulletin(false);
    }
  }

  async function handleOpenPersonalBulletinPreview() {
    setIsBuildingPersonalBulletin(true);
    try {
      const selectedRecipients = users.filter(user => {
        const isSelected = (settings.personalBulletinRecipients || []).includes(user.id);
        return user.email && isSelected;
      });

      if (selectedRecipients.length === 0) {
        setProcessMessage('⚠️ Lütfen önce kişisel bülten alıcılarını seçin.');
        setTimeout(() => setProcessMessage(''), 4000);
        setIsBuildingPersonalBulletin(false);
        return;
      }

      setPersonalBulletinRecipients(selectedRecipients);

      // Fetch real campaign/report data
      const { campaigns, reports } = await fetchPanelData();
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const turkeyDateStr = today.toLocaleDateString('tr-TR');

      // Filter campaigns for the first recipient (preview)
      const firstUser = selectedRecipients[0];
      const userCampaigns = campaigns.filter(c => c.assigneeId === firstUser.id);

      // Overdue campaigns: date < today AND only Planlandı
      const overdueCampaigns = userCampaigns.filter(c => {
        const campaignDate = new Date(c.date.getFullYear(), c.date.getMonth(), c.date.getDate());
        return campaignDate < todayStart &&
          c.status === 'Planlandı';
      }).map(c => ({
        title: c.title,
        date: c.date,
        urgency: c.urgency,
        status: c.status,
      }));

      // Today campaigns: date = today AND only Planlandı
      const todayCampaigns = userCampaigns.filter(c => {
        const campaignDate = new Date(c.date.getFullYear(), c.date.getMonth(), c.date.getDate());
        return campaignDate.getTime() === todayStart.getTime() &&
          c.status === 'Planlandı';
      }).map(c => ({
        title: c.title,
        date: c.date,
        urgency: c.urgency,
        status: c.status,
      }));

      const overdueReports = dedupeOverdueReports(reports.filter(r => {
        const dueDate = new Date(r.dueDate.getFullYear(), r.dueDate.getMonth(), r.dueDate.getDate());
        return r.assigneeId === firstUser.id &&
          dueDate < todayStart &&
          r.status !== 'done' &&
          r.status !== 'cancelled';
      }).map(r => ({
        title: r.title,
        campaignTitle: r.campaignTitle,
        dueDate: r.dueDate,
      })));

      const previewHTML = buildPersonalBulletinHTML({
        recipientName: firstUser.name,
        overdueCampaigns,
        todayCampaigns,
        overdueReports,
        dateStr: turkeyDateStr,
      });

      setPersonalBulletinPreviewHTML(previewHTML);
      setPersonalBulletinPreviewOpen(true);

    } catch (error) {
      console.error('Error building personal bulletin preview:', error);
      setProcessMessage('❌ Önizleme hazırlanırken bir hata oluştu.');
      setTimeout(() => setProcessMessage(''), 4000);
    } finally {
      setIsBuildingPersonalBulletin(false);
    }
  }

  async function handleSendPersonalBulletinManually() {
    if (!settings.resendApiKey) {
      alert('API Key eksik!');
      return;
    }

    setIsSendingPersonalBulletin(true);
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      setProcessMessage('📧 Kişisel bülten gönderimi başlatılıyor...');

      const { campaigns, reports } = await fetchPanelData();
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const turkeyDateStr = today.toLocaleDateString('tr-TR');

      for (const recipient of personalBulletinRecipients) {
        try {
          // Filter campaigns for this user
          const userCampaigns = campaigns.filter(c => c.assigneeId === recipient.id);

          // Overdue campaigns: date < today AND only Planlandı
          const overdueCampaigns = userCampaigns.filter(c => {
            const campaignDate = new Date(c.date.getFullYear(), c.date.getMonth(), c.date.getDate());
            return campaignDate < todayStart &&
              c.status === 'Planlandı';
          }).map(c => ({
            title: c.title,
            date: c.date,
            urgency: c.urgency,
            status: c.status,
          }));

          // Today campaigns: date = today AND only Planlandı
          const todayCampaigns = userCampaigns.filter(c => {
            const campaignDate = new Date(c.date.getFullYear(), c.date.getMonth(), c.date.getDate());
            return campaignDate.getTime() === todayStart.getTime() &&
              c.status === 'Planlandı';
          }).map(c => ({
            title: c.title,
            date: c.date,
            urgency: c.urgency,
            status: c.status,
          }));

          const overdueReports = dedupeOverdueReports(reports.filter(r => {
            const dueDate = new Date(r.dueDate.getFullYear(), r.dueDate.getMonth(), r.dueDate.getDate());
            return r.assigneeId === recipient.id &&
              dueDate < todayStart &&
              r.status !== 'done' &&
              r.status !== 'cancelled';
          }).map(r => ({
            title: r.title,
            campaignTitle: r.campaignTitle,
            dueDate: r.dueDate,
          })));

          if (overdueCampaigns.length === 0 && todayCampaigns.length === 0 && overdueReports.length === 0) {
            console.log(`${recipient.name}: Kampanya/rapor yok, atlanıyor`);
            skippedCount++;
            continue;
          }

          setProcessMessage(`📧 Gönderiliyor: ${recipient.name} (${sentCount + 1}/${personalBulletinRecipients.length})...`);

          const result = await sendPersonalBulletinEmail(
            settings.resendApiKey,
            recipient.email,
            recipient.name,
            overdueCampaigns,
            todayCampaigns,
            overdueReports,
            turkeyDateStr
          );

          // Log to Firestore
          try {
            const logData: any = {
              eventId: `personal-bulletin-${today.toISOString().split('T')[0]}-${recipient.id}`,
              eventType: 'personal-bulletin',
              eventTitle: `Kişisel Günlük Bülten`,
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              urgency: 'Medium',
              sentAt: new Date(),
              status: result.success ? 'success' : 'failed',
              emailProvider: 'resend',
            };

            if (result.error) {
              logData.errorMessage = result.error;
            }
            if (result.messageId) {
              logData.messageId = result.messageId;
            }

            await saveReminderLog(logData);
          } catch (logError) {
            console.error('Error saving personal bulletin log:', logError);
          }

          if (result.success) {
            sentCount++;
          } else {
            console.error(`Failed to send to ${recipient.name}:`, result.error);
            failedCount++;
          }
        } catch (error) {
          console.error(`Error sending to ${recipient.name}:`, error);
          failedCount++;
        }
      }

      setPersonalBulletinPreviewOpen(false);
      setProcessMessage(`✅ Kişisel bülten gönderimi tamamlandı!\nGönderilen: ${sentCount}, Atlanan: ${skippedCount}, Başarısız: ${failedCount}`);

      setTimeout(() => {
        loadRecentLogs();
        setProcessMessage('');
      }, 5000);

    } catch (error) {
      console.error('Error sending personal bulletins:', error);
      setProcessMessage('❌ Gönderim sırasında hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
      setTimeout(() => setProcessMessage(''), 5000);
    } finally {
      setIsSendingPersonalBulletin(false);
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

          // Log to Firestore
          try {
            const logData: any = {
              eventId: `weekly-digest-${digestContent.weekStart.toISOString().split('T')[0]}-${recipient.id}`,
              eventType: 'campaign',
              eventTitle: '📊 Haftalık Bülten',
              recipientEmail: recipient.email!,
              recipientName: recipient.username,
              urgency: 'Medium',
              sentAt: new Date(),
              status: result.success ? 'success' : 'failed',
              emailProvider: 'resend',
            };

            // Only add optional fields if they have values
            if (result.error) {
              logData.errorMessage = result.error;
            }
            if (result.messageId) {
              logData.messageId = result.messageId;
            }

            await saveReminderLog(logData);
            console.log('Weekly digest log saved for:', recipient.username);
          } catch (logError) {
            console.error('Error saving weekly digest log:', logError);
          }

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

      // Reload logs after a short delay
      setTimeout(() => {
        loadRecentLogs();
        setProcessMessage('');
      }, 2000);

    } catch (error) {
      console.error('Error sending digests:', error);
      alert('Gönderim sırasında hata oluştu.');
    } finally {
      setIsSendingDigest(false);
    }
  }

  const tabs = [
    { id: 'general' as TabType, label: 'Genel Ayarlar', icon: Settings },
    { id: 'reminders' as TabType, label: 'Hatırlatmalar', icon: Bell },
    { id: 'digests' as TabType, label: 'Bültenler', icon: Mail },
    { id: 'reports' as TabType, label: 'Rapor Bildirimleri', icon: FileText },
    { id: 'testing' as TabType, label: 'Test Araçları', icon: TestTube },
    { id: 'logs' as TabType, label: 'Gönderim Geçmişi', icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <Settings className="text-primary-700" size={28} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Bildirim & Hatırlatma Sistemi
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Email, SMS ve bülten ayarlarını yönetin
            </p>
          </div>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="px-6 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
        >
          <Save size={18} />
          {isSaving ? 'Kaydediliyor...' : 'Tüm Ayarları Kaydet'}
        </button>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-lg border ${saveMessage.includes('✅')
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* Process Message */}
      {processMessage && (
        <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 whitespace-pre-line">
          {processMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-primary-700 dark:text-primary-400 border-b-2 border-primary-700 bg-white dark:bg-slate-800'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* General Settings Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                  API Yapılandırması
                </h3>

                {/* Resend API Key */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Resend API Key *
                  </label>
                  <input
                    type="password"
                    value={settings.resendApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, resendApiKey: e.target.value })}
                    placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-500 dark:bg-slate-700 dark:text-white"
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <a
                      href="https://resend.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-700 hover:underline font-medium"
                    >
                      Resend.com
                    </a>
                    {' '}üzerinden ücretsiz API key alabilirsiniz (3,000 email/ay)
                  </p>
                </div>

                {/* SMS Settings */}
                <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Smartphone size={20} className="text-green-600" />
                        SMS Bildirimleri (Twilio)
                      </h4>
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
                        Aktif
                      </span>
                    </label>
                  </div>

                  {settings.twilioEnabled && (
                    <div className="space-y-4 pl-7">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Account SID
                          </label>
                          <input
                            type="text"
                            value={settings.twilioAccountSid || ''}
                            onChange={(e) => setSettings({ ...settings, twilioAccountSid: e.target.value })}
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white"
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
                            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white"
                          />
                        </div>
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
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white"
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
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white font-mono"
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
              </div>
            </div>
          )}

          {/* Reminders Tab */}
          {activeTab === 'reminders' && (
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="p-5 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.isEnabled}
                    onChange={(e) => setSettings({ ...settings, isEnabled: e.target.checked })}
                    className="w-5 h-5 text-primary-700 rounded focus:ring-2 focus:ring-primary-200 mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white text-base">
                      Otomatik Hatırlatmaları Aktifleştir
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Görev atamalarından sonra belirlenen süre geçtiğinde otomatik hatırlatma mailleri gönderilir
                    </p>
                    <div className="flex flex-col gap-1.5 mt-3">
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertCircle size={14} />
                        Hafta sonları (Cumartesi-Pazar) mail gönderilmez
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <Check size={14} />
                        Sunucu tarafından otomatik yönetilir (sayfayı açık tutmanıza gerek yok)
                      </p>
                    </div>
                  </div>
                </label>
              </div>

              {/* Reminder Rules */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Hatırlatma Kuralları
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Kampanyanın takvim tarihinden sonra belirtilen gün sayısı geçince hatırlatma gönderilir
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {(['Very High', 'High', 'Medium', 'Low'] as const).map((urgency) => (
                    <div key={urgency} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-28">
                        {urgency === 'Very High' ? '🔴 Çok Yüksek' :
                          urgency === 'High' ? '🟠 Yüksek' :
                            urgency === 'Medium' ? '🟡 Orta' : '🟢 Düşük'}
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
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-center focus:ring-2 focus:ring-primary-200 dark:bg-slate-700 dark:text-white font-semibold"
                      />
                      <span className="text-sm text-gray-500">gün</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Email Templates */}
              <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
                <h4 className="text-md font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <FileText size={18} className="text-primary-700" />
                  Email Şablonları
                </h4>

                {/* Subject */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Konu Satırı
                  </label>
                  <input
                    type="text"
                    value={settings.emailSubjectTemplate}
                    onChange={(e) => setSettings({ ...settings, emailSubjectTemplate: e.target.value })}
                    placeholder="⏰ Hatırlatma: {title}"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 dark:bg-slate-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Değişkenler: <code className="bg-gray-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">{'{title}'}</code>, <code className="bg-gray-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">{'{urgency}'}</code>, <code className="bg-gray-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">{'{days}'}</code>
                  </p>
                </div>

                {/* Body */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email İçeriği
                  </label>
                  <textarea
                    value={settings.emailBodyTemplate}
                    onChange={(e) => setSettings({ ...settings, emailBodyTemplate: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 dark:bg-slate-700 dark:text-white font-mono"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Kullanılabilir değişkenler:
                    <code className="bg-gray-200 dark:bg-slate-600 px-1.5 py-0.5 rounded ml-1">{'{assignee}'}</code>
                    <code className="bg-gray-200 dark:bg-slate-600 px-1.5 py-0.5 rounded ml-1">{'{title}'}</code>
                    <code className="bg-gray-200 dark:bg-slate-600 px-1.5 py-0.5 rounded ml-1">{'{urgency}'}</code>
                    <code className="bg-gray-200 dark:bg-slate-600 px-1.5 py-0.5 rounded ml-1">{'{days}'}</code>
                  </p>
                </div>

                {/* Preview */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-1.5">
                    <Eye size={14} />
                    Örnek Önizleme
                  </p>
                  <div className="text-xs text-blue-800 dark:text-blue-300 space-y-2">
                    <p><strong>Konu:</strong> {settings.emailSubjectTemplate.replace('{title}', 'Yaz Kampanyası').replace('{urgency}', 'Yüksek').replace('{days}', '2')}</p>
                    <p className="whitespace-pre-wrap bg-white dark:bg-slate-800 p-3 rounded border border-blue-200 dark:border-blue-700 text-gray-800 dark:text-gray-200">
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
            </div>
          )}

          {/* Digests Tab */}
          {activeTab === 'digests' && (
            <div className="space-y-8">
              {/* Bulletin Recipients */}
              <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  👥 Bülten Alıcıları
                </h3>

                <div className="mb-4 p-4 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-purple-900 dark:text-purple-200 font-medium mb-2">
                    📧 E-posta Gönderim Kuralları:
                  </p>
                  <ul className="text-xs text-purple-800 dark:text-purple-300 space-y-1.5 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 dark:text-purple-400">•</span>
                      <span><strong>Gün Sonu Bülteni ve Haftalık Bülten:</strong> Seçilen kullanıcılara doğrudan (TO) gönderilir</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 dark:text-purple-400">•</span>
                      <span><strong>Gecikme Bildirimleri:</strong> Seçilen kullanıcılar CC'ye eklenir</span>
                    </li>
                  </ul>
                </div>

                {departmentUsers.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Yükleniyor...</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {departmentUsers
                      .filter(user => user.isDesigner)
                      .map(user => (
                        <label
                          key={user.id}
                          className="flex items-center gap-3 p-4 rounded-lg border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 cursor-pointer transition-colors"
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
                            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-200"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 block truncate">
                              {user.username}
                              <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(Designer)</span>
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
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      ✅ <strong>{settings.emailCcRecipients?.length}</strong> kullanıcı seçildi
                    </p>
                  </div>
                )}
              </div>

              {/* Morning Bulletin */}
              <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Mail size={20} className="text-amber-600" />
                      Sabah Bülteni
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Geciken, bugünkü ve bu haftaki kampanyaları içeren sabah özeti
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.morningBulletinEnabled || false}
                      onChange={(e) => setSettings({ ...settings, morningBulletinEnabled: e.target.checked })}
                      className="w-5 h-5 text-amber-600 rounded focus:ring-2 focus:ring-amber-200"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Otomatik Gönder
                    </span>
                  </label>
                </div>

                {settings.morningBulletinEnabled && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Gönderim Saati (Türkiye Saati)
                    </label>
                    <input
                      type="time"
                      value={settings.morningBulletinTime || '08:30'}
                      onChange={(e) => setSettings({ ...settings, morningBulletinTime: e.target.value })}
                      className="px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                )}

                <div className="mb-4 p-3 bg-amber-100/60 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Alıcılar aşağıdaki <strong>Bülten Alıcıları</strong> bölümünden belirlenir (yalnızca Tasarımcı yetkisine sahip seçili kullanıcılar).
                  </p>
                </div>

                <button
                  onClick={handleOpenMorningBulletinPreview}
                  disabled={isBuildingMorningBulletin || !settings.resendApiKey}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {isBuildingMorningBulletin ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Hazırlanıyor...
                    </>
                  ) : (
                    <>
                      <Eye size={18} />
                      Önizle ve Manuel Gönder
                    </>
                  )}
                </button>
              </div>

              {/* Daily Digest */}
              <div className="p-6 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Mail size={20} className="text-green-600" />
                      Gün Sonu Bülteni
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Bugünün tamamlanan ve bekleyen kampanyalarını içerir
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.dailyDigestEnabled || false}
                      onChange={(e) => setSettings({ ...settings, dailyDigestEnabled: e.target.checked })}
                      className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-200"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Otomatik Gönder
                    </span>
                  </label>
                </div>

                {settings.dailyDigestEnabled && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Gönderim Saati (Türkiye Saati)
                    </label>
                    <input
                      type="time"
                      value={settings.dailyDigestTime || '17:00'}
                      onChange={(e) => setSettings({ ...settings, dailyDigestTime: e.target.value })}
                      className="px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                )}

                <button
                  onClick={handleOpenDailyDigestPreview}
                  disabled={isBuildingDailyDigest || !settings.resendApiKey}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {isBuildingDailyDigest ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Hazırlanıyor...
                    </>
                  ) : (
                    <>
                      <Eye size={18} />
                      Önizle ve Manuel Gönder
                    </>
                  )}
                </button>
              </div>

              {/* Weekly Digest */}
              <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Mail size={20} className="text-purple-600" />
                      Haftalık Bülten
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Gecikmiş raporlar ve bu haftanın kampanyalarını içerir
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.weeklyDigestEnabled || false}
                      onChange={(e) => setSettings({ ...settings, weeklyDigestEnabled: e.target.checked })}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-200"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Otomatik Gönder
                    </span>
                  </label>
                </div>

                {settings.weeklyDigestEnabled && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Gün
                      </label>
                      <select
                        value={settings.weeklyDigestDay || 1}
                        onChange={(e) => setSettings({ ...settings, weeklyDigestDay: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-200 dark:bg-slate-700 dark:text-white"
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
                        Saat (Türkiye Saati)
                      </label>
                      <input
                        type="time"
                        value={settings.weeklyDigestTime || '09:00'}
                        onChange={(e) => setSettings({ ...settings, weeklyDigestTime: e.target.value })}
                        className="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-200 dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {settings.weeklyDigestEnabled && (
                  <div className="mb-4 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={settings.weeklyDigestIncludeOverdueReports ?? true}
                        onChange={(e) => setSettings({ ...settings, weeklyDigestIncludeOverdueReports: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-200"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Gecikmiş raporları dahil et</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={settings.weeklyDigestIncludeThisWeekCampaigns ?? true}
                        onChange={(e) => setSettings({ ...settings, weeklyDigestIncludeThisWeekCampaigns: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-200"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Bu haftanın kampanyalarını dahil et</span>
                    </label>
                  </div>
                )}

                <button
                  onClick={handleOpenDigestPreview}
                  disabled={isBuildingDigest || !settings.resendApiKey}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {isBuildingDigest ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Hazırlanıyor...
                    </>
                  ) : (
                    <>
                      <Eye size={18} />
                      Önizle ve Manuel Gönder
                    </>
                  )}
                </button>
              </div>

              {/* Analytics Daily Bulletin */}
              <div className="p-6 bg-cyan-50 dark:bg-cyan-900/10 rounded-lg border border-cyan-200 dark:border-cyan-800">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <BarChart3 size={20} className="text-cyan-600" />
                      Analitik Günlük Bülten
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Her kullanıcıya o günkü aktif analitik işlerini gönderir (Hafta içi)
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.analyticsDailyBulletinEnabled || false}
                      onChange={(e) => setSettings({ ...settings, analyticsDailyBulletinEnabled: e.target.checked })}
                      className="w-5 h-5 text-cyan-600 rounded focus:ring-2 focus:ring-cyan-200"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Otomatik Gönder
                    </span>
                  </label>
                </div>

                {settings.analyticsDailyBulletinEnabled && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Gönderim Saati (Türkiye Saati - Sadece hafta içi)
                      </label>
                      <input
                        type="time"
                        value={settings.analyticsDailyBulletinTime || '09:00'}
                        onChange={(e) => setSettings({ ...settings, analyticsDailyBulletinTime: e.target.value })}
                        className="px-3 py-2 border border-cyan-300 dark:border-cyan-700 rounded-lg text-sm focus:ring-2 focus:ring-cyan-200 dark:bg-slate-700 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        📊 Her kullanıcı sadece kendi analitik işlerini görür. Haftasonları otomatik atlanır.
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Bülten Alacak Kişiler ({(settings.analyticsDailyBulletinRecipients || []).length} seçili)
                      </label>

                      {/* Quick Select Buttons */}
                      <div className="mb-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allUserIds = analyticsUsers.filter(u => u.email).map(u => u.id);
                            setSettings({ ...settings, analyticsDailyBulletinRecipients: allUserIds });
                          }}
                          className="px-3 py-1.5 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:hover:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 rounded text-xs font-medium transition-colors"
                        >
                          ✓ Tümünü Seç
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, analyticsDailyBulletinRecipients: [] })}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded text-xs font-medium transition-colors"
                        >
                          ✗ Tümünü Kaldır
                        </button>
                      </div>

                      {/* Individual User Selection */}
                      <div className="max-h-60 overflow-y-auto border border-cyan-200 dark:border-cyan-700 rounded-lg p-3 bg-white dark:bg-slate-800">
                        {analyticsUsers.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">Analitik kullanıcı bulunamadı</p>
                        ) : (
                          <div className="space-y-2">
                            {analyticsUsers.map(user => (
                              <label
                                key={user.id}
                                className="flex items-center gap-2 cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-900/20 p-2 rounded transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={(settings.analyticsDailyBulletinRecipients || []).includes(user.id)}
                                  onChange={(e) => {
                                    const current = settings.analyticsDailyBulletinRecipients || [];
                                    const updated = e.target.checked
                                      ? [...current, user.id]
                                      : current.filter(id => id !== user.id);
                                    setSettings({ ...settings, analyticsDailyBulletinRecipients: updated });
                                  }}
                                  className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-200"
                                />
                                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                                  {user.emoji} {user.name}
                                </span>
                                {user.email && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{user.email}</span>
                                )}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        💡 İpucu: Her kullanıcı sadece kendine atanan aktif analitik işleri alır. İşi olmayan günlerde email gönderilmez.
                      </p>
                    </div>
                  </>
                )}

                <button
                  onClick={handleOpenAnalyticsBulletinPreview}
                  disabled={isBuildingAnalyticsBulletin || !settings.resendApiKey}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm mb-4"
                >
                  {isBuildingAnalyticsBulletin ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Hazırlanıyor...
                    </>
                  ) : (
                    <>
                      <Eye size={18} />
                      Önizle ve Manuel Gönder
                    </>
                  )}
                </button>

                <div className="bg-cyan-100 dark:bg-cyan-900/30 border border-cyan-300 dark:border-cyan-700 rounded-lg p-4 text-sm">
                  <p className="text-cyan-800 dark:text-cyan-200 mb-2">
                    <strong>ℹ️ Nasıl Çalışır?</strong>
                  </p>
                  <ul className="text-cyan-700 dark:text-cyan-300 space-y-1 ml-4 list-disc">
                    <li>Her sabah belirlenen saatte çalışır</li>
                    <li>Sadece seçili analitik kullanıcılara gönderilir</li>
                    <li>Her kişi SADECE kendi analitik işlerini görür</li>
                    <li>İptal edilmiş ve tamamlanmış işler gösterilmez</li>
                    <li>Kullanıcının o gün analitik işi yoksa email gönderilmez</li>
                    <li>Haftasonları otomatik atlanır</li>
                  </ul>
                </div>
              </div>

              {/* Personal Daily Bulletin */}
              <div className="p-6 bg-violet-50 dark:bg-violet-900/10 rounded-lg border border-violet-200 dark:border-violet-800">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <UserCircle size={20} className="text-violet-600" />
                      Kişisel Günlük Bülten
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Her kullanıcıya kendi kampanyalarını gönderir (Geciken + Bugünkü)
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.personalBulletinEnabled || false}
                      onChange={(e) => setSettings({ ...settings, personalBulletinEnabled: e.target.checked })}
                      className="w-5 h-5 text-violet-600 rounded focus:ring-2 focus:ring-violet-200"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Otomatik Gönder
                    </span>
                  </label>
                </div>

                {settings.personalBulletinEnabled && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Gönderim Saati (Türkiye Saati - Sadece hafta içi)
                      </label>
                      <input
                        type="time"
                        value={settings.personalBulletinTime || '09:00'}
                        onChange={(e) => setSettings({ ...settings, personalBulletinTime: e.target.value })}
                        className="px-3 py-2 border border-violet-300 dark:border-violet-700 rounded-lg text-sm focus:ring-2 focus:ring-violet-200 dark:bg-slate-700 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        📋 Her kullanıcı sadece kendi kampanyalarını görür. Haftasonları otomatik atlanır.
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Bülten Alacak Kişiler ({(settings.personalBulletinRecipients || []).length} seçili)
                      </label>

                      {/* Quick Select Buttons */}
                      <div className="mb-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allUserIds = users.filter(u => u.email).map(u => u.id);
                            setSettings({ ...settings, personalBulletinRecipients: allUserIds });
                          }}
                          className="px-3 py-1.5 bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded text-xs font-medium transition-colors"
                        >
                          ✓ Tümünü Seç
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, personalBulletinRecipients: [] })}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded text-xs font-medium transition-colors"
                        >
                          ✗ Tümünü Kaldır
                        </button>
                      </div>

                      {/* Individual User Selection */}
                      <div className="max-h-60 overflow-y-auto border border-violet-200 dark:border-violet-700 rounded-lg p-3 bg-white dark:bg-slate-800">
                        {users.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">Kullanıcı bulunamadı</p>
                        ) : (
                          <div className="space-y-2">
                            {users.map(user => (
                              <label
                                key={user.id}
                                className="flex items-center gap-2 cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/20 p-2 rounded transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={(settings.personalBulletinRecipients || []).includes(user.id)}
                                  onChange={(e) => {
                                    const current = settings.personalBulletinRecipients || [];
                                    const updated = e.target.checked
                                      ? [...current, user.id]
                                      : current.filter(id => id !== user.id);
                                    setSettings({ ...settings, personalBulletinRecipients: updated });
                                  }}
                                  className="w-4 h-4 text-violet-600 rounded focus:ring-violet-200"
                                />
                                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                                  {user.emoji} {user.name}
                                </span>
                                {user.email && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{user.email}</span>
                                )}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        💡 İpucu: Buradaki kullanıcılar kampanya atanabilecek kişilerdir. Her kişi sadece kendine atanan kampanyaları alır.
                      </p>
                    </div>
                  </>
                )}

                <button
                  onClick={handleOpenPersonalBulletinPreview}
                  disabled={isBuildingPersonalBulletin || !settings.resendApiKey}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm mb-4"
                >
                  {isBuildingPersonalBulletin ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Hazırlanıyor...
                    </>
                  ) : (
                    <>
                      <Eye size={18} />
                      Önizle ve Manuel Gönder
                    </>
                  )}
                </button>

                <div className="bg-violet-100 dark:bg-violet-900/30 border border-violet-300 dark:border-violet-700 rounded-lg p-4 text-sm">
                  <p className="text-violet-800 dark:text-violet-200 mb-2">
                    <strong>ℹ️ Nasıl Çalışır?</strong>
                  </p>
                  <ul className="text-violet-700 dark:text-violet-300 space-y-1 ml-4 list-disc">
                    <li>Her sabah belirlenen saatte çalışır</li>
                    <li>Sadece seçili kullanıcılara gönderilir</li>
                    <li>Her kişi SADECE kendi kampanyalarını görür</li>
                    <li><strong>Geciken kampanyalar:</strong> Tarihi geçmiş ve tamamlanmamış</li>
                    <li><strong>Bugünkü kampanyalar:</strong> Bugün tarihi olan aktif kampanyalar</li>
                    <li>Kampanyası olmayan günlerde email gönderilmez</li>
                    <li>Haftasonları otomatik atlanır</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="p-5 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.reportDelayNotificationsEnabled || false}
                    onChange={(e) => setSettings({ ...settings, reportDelayNotificationsEnabled: e.target.checked })}
                    className="w-5 h-5 text-red-600 rounded focus:ring-2 focus:ring-red-200 mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white text-base">
                      Rapor Gecikme Bildirimlerini Aktifleştir
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Teslim tarihi geçmiş raporlar için otomatik e-mail gönder
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                      <AlertCircle size={14} />
                      Hafta sonları (Cumartesi-Pazar) mail gönderilmez
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gecikme Eşiği
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.reportDelayThresholdDays || 0}
                    onChange={(e) => setSettings({ ...settings, reportDelayThresholdDays: parseInt(e.target.value) || 0 })}
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-center focus:ring-2 focus:ring-red-200 dark:bg-slate-700 dark:text-white font-semibold"
                    disabled={!settings.reportDelayNotificationsEnabled}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    gün gecikmeden sonra bildirim gönder
                  </span>
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {settings.reportDelayThresholdDays === 0
                    ? '⚡ Anında gönder: Rapor teslim tarihi geçer geçmez bildirim gönderilir'
                    : `⏱️ Rapor teslim tarihinden ${settings.reportDelayThresholdDays} gün sonra bildirim gönderilir`}
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-200 mb-2 font-semibold">
                  📧 Nasıl Çalışır?
                </p>
                <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1.5 list-disc list-inside">
                  <li>Sadece "pending" (bekleyen) durumdaki raporlar kontrol edilir</li>
                  <li>Kampanyanın takvim tarihinden 30 gün sonraki teslim tarihi geçmiş raporlar tespit edilir</li>
                  <li>Atanan kişiye otomatik e-mail gönderilir</li>
                  <li>Her rapor için 24 saatte bir kez bildirim gönderilir (spam önleme)</li>
                </ul>
              </div>
            </div>
          )}

          {/* Testing Tab */}
          {activeTab === 'testing' && (
            <div className="space-y-6">
              {/* Test Email */}
              <div className="p-5 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                <h3 className="text-md font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <Mail size={20} className="text-blue-600" />
                  Test Email Gönder
                </h3>

                <div className="flex gap-3">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 dark:bg-slate-700 dark:text-white"
                  />
                  <button
                    onClick={handleSendTestEmail}
                    disabled={isTesting || !settings.resendApiKey}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    <Send size={18} />
                    {isTesting ? 'Gönderiliyor...' : 'Gönder'}
                  </button>
                </div>

                {testMessage && (
                  <div className={`mt-3 text-sm p-3 rounded-lg ${testMessage.includes('✅') ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
                    {testMessage}
                  </div>
                )}
              </div>

              {/* Test SMS */}
              {settings.twilioEnabled && (
                <div className="p-5 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                  <h3 className="text-md font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <Smartphone size={20} className="text-green-600" />
                    Test SMS Gönder
                  </h3>

                  <div className="flex gap-3">
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="+905xxxxxxxxx"
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-green-200 dark:bg-slate-700 dark:text-white"
                    />
                    <button
                      onClick={handleSendTestSMS}
                      disabled={isTestingSMS || !settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioPhoneNumber}
                      className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                      <Smartphone size={18} />
                      {isTestingSMS ? 'Gönderiliyor...' : 'Gönder'}
                    </button>
                  </div>

                  {testSMSMessage && (
                    <div className={`mt-3 text-sm p-3 rounded-lg ${testSMSMessage.includes('✅') ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
                      {testSMSMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Son Gönderilen Mailler
                </h3>
                <button
                  onClick={loadRecentLogs}
                  className="text-sm text-primary-700 hover:text-primary-800 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  🔄 Yenile
                </button>
              </div>

              {recentLogs.length === 0 ? (
                <div className="text-center py-12">
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
                      className={`flex items-center justify-between p-4 rounded-lg border ${log.status === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
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
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {log.sentAt.toLocaleDateString('tr-TR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
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
          )}
        </div>
      </div>

      {/* Digest Preview Modal */}
      {digestPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="text-purple-600" size={20} />
                Haftalık Bülten Önizleme
              </h3>
              <button
                onClick={() => setDigestPreviewOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
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

              <div className="w-full md:w-2/3 p-4 overflow-y-auto bg-white dark:bg-slate-800">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Eye size={16} />
                  Email İçeriği
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

      {analyticsBulletinPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye size={20} className="text-cyan-600" />
                Analitik Günlük Bülten Önizleme
              </h3>
              <button
                onClick={() => setAnalyticsBulletinPreviewOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 border-b border-cyan-100 dark:border-cyan-800">
              <p className="text-sm text-cyan-800 dark:text-cyan-200">
                <strong>Alıcılar ({analyticsBulletinRecipients.length}):</strong> {analyticsBulletinRecipients.map(u => u.name).join(', ')}
              </p>
              <p className="text-xs text-cyan-600 dark:text-cyan-300 mt-1">
                💡 Önizleme ilk alıcı için gösterilir. Her kullanıcı kendi analitik işlerini alır.
              </p>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-slate-900">
              <div className="bg-white rounded shadow-lg mx-auto max-w-2xl" dangerouslySetInnerHTML={{ __html: analyticsBulletinPreviewHTML }} />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-800/50 rounded-b-xl">
              <button
                onClick={() => setAnalyticsBulletinPreviewOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md font-medium transition-colors"
              >
                Kapat
              </button>
              <button
                onClick={handleSendAnalyticsBulletinManually}
                disabled={isSendingAnalyticsBulletin}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSendingAnalyticsBulletin ? (
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

      {/* Morning Bulletin Preview Modal */}
      {morningBulletinPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye size={20} className="text-amber-600" />
                Sabah Bülteni Önizleme
              </h3>
              <button
                onClick={() => setMorningBulletinPreviewOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Alıcılar ({morningBulletinRecipients.length}):</strong> {morningBulletinRecipients.map(u => u.username).join(', ')}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                💡 Tüm alıcılar aynı ekip özetini alır.
              </p>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-slate-900">
              <div className="bg-white rounded shadow-lg mx-auto max-w-2xl" dangerouslySetInnerHTML={{ __html: morningBulletinPreviewHTML }} />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-800/50 rounded-b-xl">
              <button
                onClick={() => setMorningBulletinPreviewOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md font-medium transition-colors"
              >
                Kapat
              </button>
              <button
                onClick={handleSendMorningBulletinManually}
                disabled={isSendingMorningBulletin}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSendingMorningBulletin ? (
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

      {/* Personal Bulletin Preview Modal */}
      {personalBulletinPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye size={20} className="text-violet-600" />
                Kişisel Günlük Bülten Önizleme
              </h3>
              <button
                onClick={() => setPersonalBulletinPreviewOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800">
              <p className="text-sm text-violet-800 dark:text-violet-200">
                <strong>Alıcılar ({personalBulletinRecipients.length}):</strong> {personalBulletinRecipients.map(u => u.name).join(', ')}
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-300 mt-1">
                💡 Önizleme ilk alıcı için gösterilir. Her kullanıcı kendi kampanyalarını alır.
              </p>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-slate-900">
              <div className="bg-white rounded shadow-lg mx-auto max-w-2xl" dangerouslySetInnerHTML={{ __html: personalBulletinPreviewHTML }} />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-800/50 rounded-b-xl">
              <button
                onClick={() => setPersonalBulletinPreviewOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md font-medium transition-colors"
              >
                Kapat
              </button>
              <button
                onClick={handleSendPersonalBulletinManually}
                disabled={isSendingPersonalBulletin}
                className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSendingPersonalBulletin ? (
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
