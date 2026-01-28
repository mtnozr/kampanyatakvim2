import React, { useState, useEffect } from 'react';
import { Save, Send, Check, X, AlertCircle, Mail, Settings, Play } from 'lucide-react';
import { ReminderSettings, ReminderLog, CalendarEvent, AnalyticsTask, User, AnalyticsUser } from '../types';
import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  where
} from 'firebase/firestore';
import { sendTestEmail } from '../utils/emailService';
import { processReminders } from '../utils/reminderHelper';

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
    emailBodyTemplate: 'Merhaba {assignee}, {title} görevi üzerinden {days} gün geçti.',
    updatedAt: new Date(),
  });

  const [recentLogs, setRecentLogs] = useState<ReminderLog[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [processMessage, setProcessMessage] = useState('');

  // Load settings from Firestore
  useEffect(() => {
    loadSettings();
    loadRecentLogs();
  }, []);

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

  async function handleProcessReminders() {
    if (!settings.isEnabled || !settings.resendApiKey) {
      setProcessMessage('❌ Hatırlatma sistemi aktif değil veya API key tanımlı değil');
      setTimeout(() => setProcessMessage(''), 3000);
      return;
    }

    setIsProcessing(true);
    setProcessMessage('⏳ Hatırlatmalar kontrol ediliyor...');

    try {
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

      // Process campaign reminders
      const campaignResults = await processReminders(
        campaigns,
        'campaign',
        users,
        settings
      );

      // Process analytics reminders
      const analyticsResults = await processReminders(
        analyticsTasks,
        'analytics',
        analyticsUsers,
        settings
      );

      const totalSent = campaignResults.sent + analyticsResults.sent;
      const totalFailed = campaignResults.failed + analyticsResults.failed;
      const totalSkipped = campaignResults.skipped + analyticsResults.skipped;

      setProcessMessage(
        `✅ İşlem tamamlandı!\n` +
        `Gönderilen: ${totalSent}\n` +
        `Başarısız: ${totalFailed}\n` +
        `Atlanan: ${totalSkipped}`
      );

      loadRecentLogs(); // Refresh logs
      setTimeout(() => setProcessMessage(''), 8000);
    } catch (error) {
      console.error('Error processing reminders:', error);
      setProcessMessage('❌ Hatırlatmalar işlenirken hata oluştu');
      setTimeout(() => setProcessMessage(''), 5000);
    } finally {
      setIsProcessing(false);
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

        {/* Email Templates */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Konu Şablonu
          </label>
          <input
            type="text"
            value={settings.emailSubjectTemplate}
            onChange={(e) => setSettings({ ...settings, emailSubjectTemplate: e.target.value })}
            placeholder="⏰ Hatırlatma: {title}"
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-primary-200 dark:bg-slate-700 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Değişkenler: {'{title}'}, {'{urgency}'}, {'{days}'}
          </p>
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

      {/* Manual Process Reminders */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Play size={20} className="text-primary-700" />
          Manuel Hatırlatma Kontrolü
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Tüm kampanya ve analitik görevleri kontrol eder ve gerekli hatırlatma maillerini gönderir.
        </p>

        <button
          onClick={handleProcessReminders}
          disabled={isProcessing || !settings.isEnabled || !settings.resendApiKey}
          className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Play size={18} />
          {isProcessing ? 'İşleniyor...' : 'Şimdi Kontrol Et'}
        </button>

        {processMessage && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-md text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {processMessage}
          </div>
        )}
      </div>

      {/* Recent Logs */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Son Gönderilen Mailler</h3>

        {recentLogs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Henüz mail gönderilmemiş
          </p>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-md"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {log.eventTitle}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {log.recipientName} ({log.recipientEmail})
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {log.sentAt.toLocaleDateString('tr-TR')}
                  </span>
                  {log.status === 'success' ? (
                    <Check size={18} className="text-green-500" />
                  ) : (
                    <X size={18} className="text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
