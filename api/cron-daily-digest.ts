/**
 * Vercel Cron Job for Daily Digest
 * Full implementation with all dependencies inline
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

// ===== TYPE DEFINITIONS =====

interface ReminderSettings {
    resendApiKey?: string;
    dailyDigestEnabled?: boolean;
    dailyDigestTime?: string;
    emailCcRecipients?: string[];
}

interface CalendarEvent {
    id: string;
    title: string;
    date: Date;
    status: string;
    urgency: string;
    assigneeId?: string;
    createdAt: Date;
}

interface User {
    id: string;
    name?: string;
}

interface DepartmentUser {
    id: string;
    username: string;
    name?: string;
    email?: string;
    isDesigner?: boolean;
}

interface DailyCampaignDetails {
    id: string;
    title: string;
    assigneeName: string;
    status: string;
    urgencyLabel: string;
    delayText: string;
}

interface DailyDigestContent {
    completedCampaigns: DailyCampaignDetails[];
    incompleteCampaigns: DailyCampaignDetails[];
    date: Date;
    totalCompleted: number;
    totalIncomplete: number;
}

interface ProcessResult {
    sent: number;
    failed: number;
    skipped: number;
}

// ===== FIREBASE ADMIN INITIALIZATION =====

function initFirebaseAdmin() {
    if (!admin.apps.length) {
        try {
            const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;

            if (!serviceAccountStr) {
                throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
            }

            let serviceAccount;
            try {
                serviceAccount = JSON.parse(serviceAccountStr);
            } catch (e) {
                throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
            }

            // Fix private_key newlines
            if (serviceAccount.private_key) {
                const rawKey = serviceAccount.private_key;
                let key = rawKey.replace(/\\n/g, '\n');

                const match = key.match(/-----BEGIN PRIVATE KEY-----([\s\S]*)-----END PRIVATE KEY-----/);
                if (match && match[1]) {
                    const body = match[1].replace(/\s/g, '');
                    key = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
                }

                serviceAccount.private_key = key;
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } catch (error: any) {
            console.error('Firebase Admin Initialization Error:', error);
            throw error;
        }
    }

    return admin;
}

// ===== UTILITY FUNCTIONS =====

// Turkey timezone offset (UTC+3)
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000;

function isSameDay(date1: Date, date2: Date): boolean {
    // Compare dates in Turkey timezone (UTC+3)
    const d1 = new Date(date1.getTime() + TURKEY_OFFSET_MS);
    const d2 = new Date(date2.getTime() + TURKEY_OFFSET_MS);
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
}

function getUserName(userId: string | undefined, users: User[]): string {
    if (!userId) return 'Atanmamış';
    const user = users.find(u => u.id === userId);
    return user?.name || 'Bilinmiyor';
}

function getUrgencyLabel(urgency: string): string {
    const labels: Record<string, string> = {
        'Very High': 'Çok Yüksek',
        'High': 'Yüksek',
        'Medium': 'Orta',
        'Low': 'Düşük',
    };
    return labels[urgency] || urgency;
}

function calculateDelay(createdAt: Date, now: Date): string {
    const diffMs = now.getTime() - createdAt.getTime();
    if (diffMs < 0) return '-';
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days > 0 && hours > 0) return `${days} gün ${hours} saat`;
    if (days > 0) return `${days} gün`;
    if (hours > 0) return `${hours} saat`;
    return '< 1 saat';
}

// ===== DAILY DIGEST BUILDER =====

function buildDailyDigest(
    campaigns: CalendarEvent[],
    users: User[],
    targetDate: Date = new Date()
): DailyDigestContent {
    // Filter campaigns for the target date
    const todaysCampaigns = campaigns.filter(campaign =>
        isSameDay(campaign.date, targetDate) && campaign.status !== 'İptal Edildi'
    );

    const completedCampaigns: DailyCampaignDetails[] = [];
    const incompleteCampaigns: DailyCampaignDetails[] = [];

    const now = new Date();
    todaysCampaigns.forEach(campaign => {
        const details: DailyCampaignDetails = {
            id: campaign.id,
            title: campaign.title,
            assigneeName: getUserName(campaign.assigneeId, users),
            status: campaign.status || 'Planlandı',
            urgencyLabel: getUrgencyLabel(campaign.urgency),
            delayText: calculateDelay(campaign.createdAt, now),
        };

        if (campaign.status === 'Tamamlandı') {
            completedCampaigns.push(details);
        } else {
            incompleteCampaigns.push(details);
        }
    });

    return {
        completedCampaigns,
        incompleteCampaigns,
        date: targetDate,
        totalCompleted: completedCampaigns.length,
        totalIncomplete: incompleteCampaigns.length
    };
}

// ===== EMAIL HTML BUILDER =====

function buildDailyDigestHTML(params: {
    recipientName: string;
    digestContent: DailyDigestContent;
}): string {
    const { recipientName, digestContent } = params;
    const date = digestContent.date;

    const dateStr = date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long'
    });

    // Build completed campaigns table
    let completedHTML = '';
    if (digestContent.totalCompleted > 0) {
        completedHTML = `
            <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #059669; font-weight: 600;">
                ✅ Tamamlananlar (${digestContent.totalCompleted})
            </h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #ECFDF5; border: 1px solid #059669; border-radius: 8px; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #D1FAE5;">
                        <th style="text-align: left; font-size: 12px; color: #064E3B; font-weight: 600; padding: 12px 8px;">Kampanya</th>
                        <th style="text-align: center; font-size: 12px; color: #064E3B; font-weight: 600; padding: 12px 8px;">Aciliyet</th>
                        <th style="text-align: left; font-size: 12px; color: #064E3B; font-weight: 600; padding: 12px 8px;">Atanan</th>
                        <th style="text-align: center; font-size: 12px; color: #064E3B; font-weight: 600; padding: 12px 8px;">Gecikme</th>
                    </tr>
                </thead>
                <tbody>
                    ${digestContent.completedCampaigns.map(campaign => `
                        <tr style="border-top: 1px solid #34D399;">
                            <td style="font-size: 13px; color: #065F46; padding: 8px;"><strong>${campaign.title}</strong></td>
                            <td style="font-size: 13px; color: #065F46; padding: 8px; text-align: center;">${campaign.urgencyLabel}</td>
                            <td style="font-size: 13px; color: #065F46; padding: 8px;">${campaign.assigneeName}</td>
                            <td style="font-size: 13px; color: #065F46; padding: 8px; text-align: center;">${campaign.delayText}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        completedHTML = `
            <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #6B7280; font-weight: 600;">
                ✅ Tamamlananlar
            </h3>
            <div style="background-color: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #4B5563;">
                    Bugün tamamlanan kampanya bulunmuyor.
                </p>
            </div>
        `;
    }

    // Build incomplete campaigns table
    let incompleteHTML = '';
    if (digestContent.totalIncomplete > 0) {
        incompleteHTML = `
            <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #BE123C; font-weight: 600;">
                ⏳ Tamamlanmayanlar / Bekleyenler (${digestContent.totalIncomplete})
            </h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #FFF1F2; border: 1px solid #BE123C; border-radius: 8px; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #FFE4E6;">
                        <th style="text-align: left; font-size: 12px; color: #881337; font-weight: 600; padding: 12px 8px;">Kampanya</th>
                        <th style="text-align: center; font-size: 12px; color: #881337; font-weight: 600; padding: 12px 8px;">Durum</th>
                        <th style="text-align: left; font-size: 12px; color: #881337; font-weight: 600; padding: 12px 8px;">Atanan</th>
                        <th style="text-align: center; font-size: 12px; color: #881337; font-weight: 600; padding: 12px 8px;">Gecikme</th>
                    </tr>
                </thead>
                <tbody>
                    ${digestContent.incompleteCampaigns.map(campaign => `
                        <tr style="border-top: 1px solid #FDA4AF;">
                            <td style="font-size: 13px; color: #9F1239; padding: 8px;"><strong>${campaign.title}</strong></td>
                            <td style="font-size: 13px; color: #9F1239; padding: 8px; text-align: center;">${campaign.status}</td>
                            <td style="font-size: 13px; color: #9F1239; padding: 8px;">${campaign.assigneeName}</td>
                            <td style="font-size: 13px; color: #9F1239; padding: 8px; text-align: center;">${campaign.delayText}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        incompleteHTML = `
            <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #6B7280; font-weight: 600;">
                ⏳ Tamamlanmayanlar
            </h3>
            <div style="background-color: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #4B5563;">
                    Bugün için bekleyen kampanya bulunmuyor.
                </p>
            </div>
        `;
    }

    return `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Gün Sonu Bülteni</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F8F9FE;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FE; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="650" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <tr>
                                <td style="background-color: #F9FAFB; padding: 32px; text-align: center; border-bottom: 1px solid #E5E7EB;">
                                    <h1 style="margin: 0; color: #1F2937; font-size: 28px; font-weight: 700;">🌅 Gün Sonu Bülteni</h1>
                                    <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 16px; font-weight: 500;">${dateStr}</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 32px;">
                                    <p style="margin: 0 0 24px 0; font-size: 16px; color: #1F2937;">İyi Akşamlar <strong>${recipientName}</strong>,</p>
                                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">Bugünün kampanya özeti aşağıdadır:</p>
                                    ${completedHTML}
                                    ${incompleteHTML}
                                    <div style="text-align: center; margin: 32px 0;">
                                        <a href="https://www.kampanyatakvimi.net.tr" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">Takvime Git →</a>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style="background-color: #F9FAFB; padding: 24px; text-align: center; border-top: 1px solid #E5E7EB;">
                                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">Bu otomatik bir gün sonu özetidir.</p>
                                    <p style="margin: 0; font-size: 12px; color: #9CA3AF;">Kampanya Takvimi © ${new Date().getFullYear()}</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
}

// ===== EMAIL SENDING =====

async function sendEmailInternal(apiKey: string, params: {
    to: string;
    subject: string;
    html: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Kampanya Takvimi <hatirlatma@kampanyatakvimi.net.tr>',
                to: params.to,
                subject: params.subject,
                html: params.html,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return { success: false, error: error.message || 'Email sending failed' };
        }

        const data = await response.json();
        return { success: true, messageId: data.id };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

// ===== DIGEST LOCK & LOGGING =====

async function checkDigestAlreadySent(db: Firestore, dateStr: string): Promise<boolean> {
    try {
        const logsRef = db.collection('reminderLogs');
        const snapshot = await logsRef
            .where('eventId', '==', `daily-digest-${dateStr}`)
            .where('status', '==', 'success')
            .get();

        return snapshot.size >= 10; // Geçici: günde 10 kez gönderime izin ver
    } catch (error) {
        console.error('Error checking existing digest:', error);
        return false;
    }
}

async function acquireDailyDigestLock(db: Firestore, dateStr: string): Promise<boolean> {
    const lockRef = db.collection('systemLocks').doc(`daily-digest-${dateStr}`);

    try {
        return await db.runTransaction(async (transaction) => {
            const lockDoc = await transaction.get(lockRef);

            if (lockDoc.exists) {
                return false;
            }

            transaction.set(lockRef, {
                createdAt: Timestamp.now(),
                status: 'processing'
            });

            return true;
        });
    } catch (error) {
        console.error('Error acquiring lock:', error);
        return false;
    }
}

async function logDailyDigest(db: Firestore, params: {
    recipientEmail: string;
    recipientName: string;
    status: 'success' | 'failed';
    digestContent: DailyDigestContent;
    errorMessage?: string;
    messageId?: string;
}): Promise<void> {
    try {
        const dateStr = params.digestContent.date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        const logEntry: Record<string, any> = {
            eventId: `daily-digest-${params.digestContent.date.toISOString().split('T')[0]}`,
            eventType: 'daily-digest',
            eventTitle: `Gün Sonu Bülteni - ${dateStr}`,
            recipientEmail: params.recipientEmail,
            recipientName: params.recipientName,
            urgency: 'Medium',
            sentAt: Timestamp.now(),
            status: params.status,
            emailProvider: 'resend',
            digestStats: {
                completedCount: params.digestContent.totalCompleted,
                incompleteCount: params.digestContent.totalIncomplete,
            },
        };
        if (params.errorMessage) logEntry.errorMessage = params.errorMessage;
        if (params.messageId) logEntry.messageId = params.messageId;
        await db.collection('reminderLogs').add(logEntry);
    } catch (error) {
        console.error('Error logging daily digest:', error);
    }
}

// ===== MAIN PROCESSOR =====

async function processDailyDigest(
    db: Firestore,
    campaigns: CalendarEvent[],
    users: User[],
    departmentUsers: DepartmentUser[],
    settings: ReminderSettings
): Promise<ProcessResult> {
    const result: ProcessResult = { sent: 0, failed: 0, skipped: 0 };
    const now = new Date();

    console.log('=== DAILY DIGEST PROCESS START ===');
    console.log('dailyDigestEnabled:', settings.dailyDigestEnabled);
    console.log('dailyDigestTime:', settings.dailyDigestTime);
    console.log('emailCcRecipients count:', settings.emailCcRecipients?.length || 0);

    if (!settings.dailyDigestEnabled) {
        console.log('❌ REASON: Daily digest is disabled');
        return result;
    }

    if (!settings.dailyDigestTime) {
        console.log('❌ REASON: No daily digest time configured');
        return result;
    }

    // Parse configured time (assumed to be in Turkey time - UTC+3)
    const [targetHour, targetMinute] = settings.dailyDigestTime.split(':').map(Number);

    // Convert server time (UTC) to Turkey time (UTC+3)
    const turkeyTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    const currentHour = turkeyTime.getHours();
    const currentMinute = turkeyTime.getMinutes();

    console.log('Target time:', `${targetHour}:${targetMinute} Turkey`);
    console.log('Current time:', `${currentHour}:${currentMinute} Turkey`);

    // Only process if it's time
    const isTime = currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);

    console.log('Is time to send?', isTime);
    if (!isTime) {
        console.log('❌ REASON: Not time yet for daily digest');
        return result;
    }

    // Check if already sent today
    const todayStr = now.toISOString().split('T')[0];
    const alreadySent = await checkDigestAlreadySent(db, todayStr);
    if (alreadySent) {
        console.log('Daily digest already sent for today');
        return result;
    }

    // ⚠️ TEMP: Lock devre dışı - günde 10 gönderim testi için
    // const lockAcquired = await acquireDailyDigestLock(db, todayStr);
    // if (!lockAcquired) {
    //     console.log('Could not acquire lock for daily digest');
    //     return result;
    // }

    console.log('Processing daily digest...');

    if (!settings.resendApiKey) {
        console.error('Resend API key is not configured');
        return result;
    }

    // Build digest content
    const digestContent = buildDailyDigest(campaigns, users, now);

    // Filter designer users
    const designerUsers = departmentUsers.filter(user => {
        const isSelected = (settings.emailCcRecipients || []).includes(user.id);
        return user.isDesigner && user.email && isSelected;
    });

    if (designerUsers.length === 0) {
        console.log('No designer users found');
        return result;
    }

    console.log(`Sending to ${designerUsers.length} designer users`);

    // OPTIMIZATION 4: Collect logs and batch write them at the end
    const logsToWrite: any[] = [];

    let emailsSentCount = 0;

    // Send email to each designer
    for (const designer of designerUsers) {
        try {
            const html = buildDailyDigestHTML({
                recipientName: designer.name || designer.username,
                digestContent
            });

            const emailResult = await sendEmailInternal(
                settings.resendApiKey,
                {
                    to: designer.email!,
                    subject: `Gün Sonu Bülteni - ${now.toLocaleDateString('tr-TR')}`,
                    html
                }
            );

            if (emailResult.success) {
                console.log(`✅ Sent to ${designer.name || designer.username}`);
                result.sent++;
                emailsSentCount++;

                // Collect log data instead of writing immediately
                logsToWrite.push({
                    recipientEmail: designer.email!,
                    recipientName: designer.name || designer.username,
                    status: 'success',
                    digestContent,
                    messageId: emailResult.messageId,
                });
            } else {
                console.error(`❌ Failed to send to ${designer.name}: ${emailResult.error}`);
                result.failed++;

                logsToWrite.push({
                    recipientEmail: designer.email!,
                    recipientName: designer.name || designer.username,
                    status: 'failed',
                    digestContent,
                    errorMessage: emailResult.error,
                });
            }
        } catch (error) {
            console.error(`Error sending to ${designer.name}:`, error);
            result.failed++;

            logsToWrite.push({
                recipientEmail: designer.email!,
                recipientName: designer.name || designer.username,
                status: 'failed',
                digestContent,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    // Batch write all logs at once (saves Firestore writes)
    console.log(`Writing ${logsToWrite.length} logs in batch...`);
    const batch = db.batch();
    for (const logData of logsToWrite) {
        const logRef = db.collection('reminderLogs').doc();
        const dateStr = logData.digestContent.date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        const logEntry: Record<string, any> = {
            eventId: `daily-digest-${logData.digestContent.date.toISOString().split('T')[0]}`,
            eventType: 'daily-digest',
            eventTitle: `Gün Sonu Bülteni - ${dateStr}`,
            recipientEmail: logData.recipientEmail,
            recipientName: logData.recipientName,
            urgency: 'Medium',
            sentAt: Timestamp.now(),
            status: logData.status,
            emailProvider: 'resend',
            digestStats: {
                completedCount: logData.digestContent.totalCompleted,
                incompleteCount: logData.digestContent.totalIncomplete,
            },
        };
        if (logData.errorMessage) logEntry.errorMessage = logData.errorMessage;
        if (logData.messageId) logEntry.messageId = logData.messageId;
        batch.set(logRef, logEntry);
    }

    if (logsToWrite.length > 0) {
        await batch.commit();
        console.log('✅ Batch write completed');
    }

    return result;
}

// ===== HANDLER =====

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // Verify Authorization
    const authHeader = req.headers.authorization;
    const queryKey = Array.isArray(req.query.key) ? req.query.key[0] : req.query.key;
    const expectedKey = process.env.CRON_SECRET_KEY;

    if (queryKey !== expectedKey && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn('Unauthorized cron request');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('Starting Daily Digest Cron Job...');

        // Initialize Firebase Admin
        const adminSDK = initFirebaseAdmin();
        const db = adminSDK.firestore();

        // Load Settings
        const settingsDoc = await db.collection('reminderSettings').doc('default').get();

        if (!settingsDoc.exists) {
            console.error('No settings found');
            return res.status(500).json({ error: 'Settings not configured' });
        }

        const settings = settingsDoc.data() as ReminderSettings;

        if (!settings.dailyDigestEnabled) {
            console.log('Daily digest is disabled');
            return res.status(200).json({ status: 'skipped', reason: 'disabled' });
        }

        if (!settings.dailyDigestTime) {
            console.log('No daily digest time configured');
            return res.status(200).json({ status: 'skipped', reason: 'no_time_set' });
        }

        // Fetch Data (OPTIMIZED)
        console.log('Fetching data...');

        // Calculate today's date range (Turkey time, converted back to UTC for Firestore query)
        const now = new Date();
        const turkeyTime = new Date(now.getTime() + TURKEY_OFFSET_MS);
        const turkeyYear = turkeyTime.getUTCFullYear();
        const turkeyMonth = turkeyTime.getUTCMonth();
        const turkeyDate = turkeyTime.getUTCDate();

        // Turkey midnight in UTC: e.g. Turkey Feb 5 00:00 = UTC Feb 4 21:00
        const startOfDay = new Date(Date.UTC(turkeyYear, turkeyMonth, turkeyDate, 0, 0, 0) - TURKEY_OFFSET_MS);
        // Turkey end of day in UTC: e.g. Turkey Feb 5 23:59:59 = UTC Feb 5 20:59:59
        const endOfDay = new Date(Date.UTC(turkeyYear, turkeyMonth, turkeyDate, 23, 59, 59, 999) - TURKEY_OFFSET_MS);

        // OPTIMIZATION 1: Only fetch today's events instead of all events
        const campaignsSnapshot = await db.collection('events')
            .where('date', '>=', Timestamp.fromDate(startOfDay))
            .where('date', '<=', Timestamp.fromDate(endOfDay))
            .get();

        console.log(`Fetched ${campaignsSnapshot.size} events for today`);

        const campaigns = campaignsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date?.toDate() || new Date(),
                createdAt: data.createdAt?.toDate() || new Date(),
            };
        }) as CalendarEvent[];

        // Get unique assignee IDs from today's campaigns
        const assigneeIds = [...new Set(campaigns.map(c => c.assigneeId).filter(Boolean))];

        // OPTIMIZATION 2: Only fetch users that are assigned to today's campaigns
        let users: User[] = [];
        if (assigneeIds.length > 0) {
            // Firestore 'in' query supports max 10 items, so batch if needed
            const userBatches = [];
            for (let i = 0; i < assigneeIds.length; i += 10) {
                const batch = assigneeIds.slice(i, i + 10);
                const snapshot = await db.collection('users')
                    .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                    .get();
                userBatches.push(...snapshot.docs);
            }
            users = userBatches.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as User[];
            console.log(`Fetched ${users.length} assigned users`);
        }

        // OPTIMIZATION 3: Only fetch department users that are in email recipients list
        const recipientIds = settings.emailCcRecipients || [];
        let deptUsers: DepartmentUser[] = [];

        if (recipientIds.length > 0) {
            // Batch fetch in groups of 10
            const deptUserBatches = [];
            for (let i = 0; i < recipientIds.length; i += 10) {
                const batch = recipientIds.slice(i, i + 10);
                const snapshot = await db.collection('departmentUsers')
                    .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                    .get();
                deptUserBatches.push(...snapshot.docs);
            }
            deptUsers = deptUserBatches.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as DepartmentUser[];
            console.log(`Fetched ${deptUsers.length} department users`);
        }

        // Process
        console.log('Processing digest...');
        const result = await processDailyDigest(db, campaigns, users, deptUsers, settings);

        return res.status(200).json({
            success: true,
            result
        });

    } catch (error) {
        console.error('Cron job error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
