import React, { useState, useEffect } from 'react';
import { Save, Send, Check, X, AlertCircle, Mail, Settings, Eye, Smartphone, Users, FileText, Clock, Bell, TestTube } from 'lucide-react';
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
import { buildWeeklyDigestHTML, sendWeeklyDigestEmail, buildDailyDigestHTML, sendDailyDigestEmail, buildPersonalBulletinHTML, sendPersonalBulletinEmail } from '../utils/emailService';
import { buildDailyDigest } from '../utils/dailyDigestBuilder';
import { buildPersonalBulletin } from '../utils/personalBulletinBuilder';

type TabType = 'general' | 'reminders' | 'digests' | 'reports' | 'recipients' | 'testing' | 'logs';

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

  const [personalBulletinPreviewOpen, setPersonalBulletinPreviewOpen] = useState(false);
  const [personalBulletinPreviewHTML, setPersonalBulletinPreviewHTML] = useState('');
  const [isBuildingPersonalBulletin, setIsBuildingPersonalBulletin] = useState(false);
  const [isSendingPersonalBulletin, setIsSendingPersonalBulletin] = useState(false);
  const [personalBulletinRecipients, setPersonalBulletinRecipients] = useState<DepartmentUser[]>([]);

  const [saveMessage, setSaveMessage] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testSMSMessage, setTestSMSMessage] = useState('');
  const [processMessage, setProcessMessage] = useState('');

  useEffect(() => {
    loadSettings();
    loadRecentLogs();
    loadDepartmentUsers();
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

  async function handleOpenPersonalBulletinPreview() {
    setIsBuildingPersonalBulletin(true);
    try {
      const { campaigns, reports, analyticsTasks, deptUsers } = await fetchPanelData();

      const selectedRecipients = deptUsers.filter(user => {
        const isSelected = (settings.personalDailyBulletinRecipients || []).includes(user.id);
        return user.email && isSelected;
      });

      if (selectedRecipients.length === 0) {
        setProcessMessage('⚠️ Lütfen önce "Bildirimler > Özetler" sekmesinden kişisel bülten alıcılarını seçin.');
        setTimeout(() => setProcessMessage(''), 4000);
        setIsBuildingPersonalBulletin(false);
        return;
      }

      setPersonalBulletinRecipients(selectedRecipients);

      // Build bulletin for first recipient as preview
      const firstRecipient = selectedRecipients[0];
      const bulletinContent = buildPersonalBulletin(
        campaigns,
        reports,
        analyticsTasks,
        firstRecipient.id
      );

      const previewHTML = buildPersonalBulletinHTML({
        recipientName: firstRecipient.username,
        campaigns: bulletinContent.campaigns,
        reports: bulletinContent.reports,
        analyticsTasks: bulletinContent.analyticsTasks,
        date: bulletinContent.date,
        totalCount: bulletinContent.totalCount
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
    let failedCount = 0;

    try {
      const { campaigns, reports, analyticsTasks } = await fetchPanelData();

      for (const recipient of personalBulletinRecipients) {
        try {
          const bulletinContent = buildPersonalBulletin(
            campaigns,
            reports,
            analyticsTasks,
            recipient.id
          );

          const result = await sendPersonalBulletinEmail(
            settings.resendApiKey,
            recipient.email!,
            recipient.username,
            bulletinContent
          );

          // Log to Firestore
          try {
            const logData: any = {
              eventId: `personal-bulletin-${new Date().toISOString().split('T')[0]}-${recipient.id}`,
              eventType: 'campaign',
              eventTitle: '📋 Kişisel Günlük Bülten',
              recipientEmail: recipient.email!,
              recipientName: recipient.username,
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
            console.log('Personal bulletin log saved for:', recipient.username);
          } catch (logError) {
            console.error('Error saving personal bulletin log:', logError);
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

      setPersonalBulletinPreviewOpen(false);
      setProcessMessage(`✅ Kişisel bülten gönderimi tamamlandı!\nGönderilen: ${sentCount}, Başarısız: ${failedCount}`);

      // Reload logs after a short delay
      setTimeout(() => {
        loadRecentLogs();
        setProcessMessage('');
      }, 2000);

    } catch (error) {
      console.error('Error sending personal bulletins:', error);
      alert('Gönderim sırasında hata oluştu.');
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
    { id: 'recipients' as TabType, label: 'Alıcılar', icon: Users },
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

              {/* Personal Daily Bulletin */}
              <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Mail size={20} className="text-blue-600" />
                      Kişisel Günlük Bülten
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Her kullanıcıya o günkü "Planlandı" durumundaki kampanya, rapor ve analitik işlerini gönderir (Hafta içi)
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.personalDailyBulletinEnabled || false}
                      onChange={(e) => setSettings({ ...settings, personalDailyBulletinEnabled: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-200"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Otomatik Gönder
                    </span>
                  </label>
                </div>

                {settings.personalDailyBulletinEnabled && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Gönderim Saati (Türkiye Saati - Sadece hafta içi)
                      </label>
                      <input
                        type="time"
                        value={settings.personalDailyBulletinTime || '09:00'}
                        onChange={(e) => setSettings({ ...settings, personalDailyBulletinTime: e.target.value })}
                        className="px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 dark:bg-slate-700 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        🔔 Her kullanıcı sadece kendi işlerini görür. Haftasonları otomatik atlanır.
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Bülten Alacak Kişiler ({(settings.personalDailyBulletinRecipients || []).length} seçili)
                      </label>

                      {/* Quick Select Buttons */}
                      <div className="mb-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allUserIds = departmentUsers.filter(u => u.email).map(u => u.id);
                            setSettings({ ...settings, personalDailyBulletinRecipients: allUserIds });
                          }}
                          className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-medium transition-colors"
                        >
                          ✓ Tümünü Seç
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, personalDailyBulletinRecipients: [] })}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded text-xs font-medium transition-colors"
                        >
                          ✗ Tümünü Kaldır
                        </button>
                      </div>

                      {/* Role-based Selection */}
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2">Rol Bazlı Seçim:</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const designers = departmentUsers.filter(u => u.isDesigner && u.email).map(u => u.id);
                              const current = settings.personalDailyBulletinRecipients || [];
                              const updated = [...new Set([...current, ...designers])];
                              setSettings({ ...settings, personalDailyBulletinRecipients: updated });
                            }}
                            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs border border-blue-300 dark:border-blue-600 transition-colors"
                          >
                            + Tasarımcılar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const kampanyaYapan = departmentUsers.filter(u => u.isKampanyaYapan && u.email).map(u => u.id);
                              const current = settings.personalDailyBulletinRecipients || [];
                              const updated = [...new Set([...current, ...kampanyaYapan])];
                              setSettings({ ...settings, personalDailyBulletinRecipients: updated });
                            }}
                            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs border border-blue-300 dark:border-blue-600 transition-colors"
                          >
                            + Kampanya Yapanlar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const analitik = departmentUsers.filter(u => u.isAnalitik && u.email).map(u => u.id);
                              const current = settings.personalDailyBulletinRecipients || [];
                              const updated = [...new Set([...current, ...analitik])];
                              setSettings({ ...settings, personalDailyBulletinRecipients: updated });
                            }}
                            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs border border-blue-300 dark:border-blue-600 transition-colors"
                          >
                            + Analitik
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const businessUnit = departmentUsers.filter(u => u.isBusinessUnit && u.email).map(u => u.id);
                              const current = settings.personalDailyBulletinRecipients || [];
                              const updated = [...new Set([...current, ...businessUnit])];
                              setSettings({ ...settings, personalDailyBulletinRecipients: updated });
                            }}
                            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs border border-blue-300 dark:border-blue-600 transition-colors"
                          >
                            + İş Birimi
                          </button>
                        </div>
                      </div>

                      {/* Individual User Selection */}
                      <div className="max-h-60 overflow-y-auto border border-blue-200 dark:border-blue-700 rounded-lg p-3 bg-white dark:bg-slate-800">
                        {departmentUsers.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">Kullanıcı bulunamadı</p>
                        ) : (
                          <div className="space-y-2">
                            {departmentUsers.map(user => {
                              const roles = [];
                              if (user.isDesigner) roles.push('Tasarımcı');
                              if (user.isKampanyaYapan) roles.push('Kampanya');
                              if (user.isAnalitik) roles.push('Analitik');
                              if (user.isBusinessUnit) roles.push('İş Birimi');
                              const roleText = roles.length > 0 ? roles.join(', ') : 'Rol yok';

                              return (
                                <label
                                  key={user.id}
                                  className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={(settings.personalDailyBulletinRecipients || []).includes(user.id)}
                                    onChange={(e) => {
                                      const current = settings.personalDailyBulletinRecipients || [];
                                      const updated = e.target.checked
                                        ? [...current, user.id]
                                        : current.filter(id => id !== user.id);
                                      setSettings({ ...settings, personalDailyBulletinRecipients: updated });
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-200"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {user.username}
                                      </span>
                                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
                                        {roleText}
                                      </span>
                                    </div>
                                    {user.email && (
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {user.email}
                                      </span>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        💡 İpucu: Her kullanıcı sadece kendine atanan ve "Planlandı" durumundaki kampanya, rapor ve analitik işlerini alır. İşi olmayan günlerde email gönderilmez.
                      </p>
                    </div>
                  </>
                )}

                <button
                  onClick={handleOpenPersonalBulletinPreview}
                  disabled={isBuildingPersonalBulletin || !settings.resendApiKey}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm mb-4"
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

                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg p-4 text-sm">
                  <p className="text-blue-800 dark:text-blue-200 mb-2">
                    <strong>ℹ️ Nasıl Çalışır?</strong>
                  </p>
                  <ul className="text-blue-700 dark:text-blue-300 space-y-1 ml-4 list-disc">
                    <li>Her sabah belirlenen saatte çalışır</li>
                    <li>Sadece seçili kişilere gönderilir</li>
                    <li>Her kişi SADECE kendi işlerini görür</li>
                    <li>Kampanyalar: Sadece "Planlandı" durumundakiler gösterilir</li>
                    <li>Email 3 kategoriye ayrılır: Kampanya, Rapor, Analitik</li>
                    <li>Kullanıcının o gün işi yoksa email gönderilmez</li>
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

          {/* Recipients Tab */}
          {activeTab === 'recipients' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-200 font-medium mb-2">
                  👥 Bülten Alıcıları
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  Seçilen Designer kullanıcıları günlük ve haftalık bülten maillerini alacaktır.
                  Ayrıca tüm hatırlatma maillerine CC olarak eklenirler.
                </p>
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
                        className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
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
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    ✅ <strong>{settings.emailCcRecipients?.length}</strong> kullanıcı seçildi
                  </p>
                </div>
              )}
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

      {/* Personal Bulletin Preview Modal */}
      {personalBulletinPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye size={20} className="text-blue-600" />
                Kişisel Günlük Bülten Önizleme
              </h3>
              <button
                onClick={() => setPersonalBulletinPreviewOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Alıcılar ({personalBulletinRecipients.length}):</strong> {personalBulletinRecipients.map(u => u.username).join(', ')}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                💡 Önizleme ilk alıcı için gösterilir. Her kullanıcı kendi işlerini alır.
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
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
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
