/**
 * Vercel Cron Job for Analytics Daily Bulletin
 * Sends each analytics user their daily analytics tasks
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

// ===== TYPE DEFINITIONS =====

interface ReminderSettings {
    resendApiKey?: string;
    analyticsDailyBulletinEnabled?: boolean;
    analyticsDailyBulletinTime?: string;
    analyticsDailyBulletinRecipients?: string[];
}

interface AnalyticsTask {
    id: string;
    title: string;
    date: Date;
    status: string;
    urgency: string;
    assigneeId?: string;
    notes?: string;
}

interface AnalyticsUser {
    id: string;
    name: string;
    email?: string;
}

interface AnalyticsBulletinContent {
    analyticsTasks: AnalyticsTask[];
    date: Date;
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

const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3

function isSameDay(date1: Date, date2: Date): boolean {
    // Compare in Turkey timezone (UTC+3)
    const d1 = new Date(date1.getTime() + TURKEY_OFFSET_MS);
    const d2 = new Date(date2.getTime() + TURKEY_OFFSET_MS);
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
}

function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
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

// ===== ANALYTICS BULLETIN BUILDER =====

function buildAnalyticsBulletin(
    analyticsTasks: AnalyticsTask[],
    userId: string,
    targetDate: Date = new Date()
): AnalyticsBulletinContent {
    // Filter for today and assigned to this user (active tasks: not cancelled or completed)
    const userTasks = analyticsTasks.filter(t =>
        isSameDay(t.date, targetDate) &&
        t.assigneeId === userId &&
        t.status !== 'İptal Edildi' &&
        t.status !== 'Tamamlandı'
    );

    return {
        analyticsTasks: userTasks,
        date: targetDate
    };
}

// ===== EMAIL HTML BUILDER =====

function buildAnalyticsBulletinHTML(params: {
    recipientName: string;
    bulletinContent: AnalyticsBulletinContent;
}): string {
    const { recipientName, bulletinContent } = params;
    const date = bulletinContent.date;

    const dateStr = date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long'
    });

    const totalTasks = bulletinContent.analyticsTasks.length;

    // Build analytics tasks section
    let analyticsHTML = '';
    if (bulletinContent.analyticsTasks.length > 0) {
        analyticsHTML = `
            <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #3B82F6; font-weight: 600;">
                📈 Analitik İşler (${bulletinContent.analyticsTasks.length})
            </h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #EFF6FF; border: 1px solid #3B82F6; border-radius: 8px; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #DBEAFE;">
                        <th style="text-align: left; font-size: 12px; color: #1E40AF; font-weight: 600; padding: 12px 8px;">İş</th>
                        <th style="text-align: center; font-size: 12px; color: #1E40AF; font-weight: 600; padding: 12px 8px;">Aciliyet</th>
                        <th style="text-align: center; font-size: 12px; color: #1E40AF; font-weight: 600; padding: 12px 8px;">Durum</th>
                    </tr>
                </thead>
                <tbody>
                    ${bulletinContent.analyticsTasks.map(task => `
                        <tr style="border-top: 1px solid #93C5FD;">
                            <td style="font-size: 13px; color: #1E40AF; padding: 8px;"><strong>${task.title}</strong></td>
                            <td style="font-size: 13px; color: #1E40AF; padding: 8px; text-align: center;">${getUrgencyLabel(task.urgency)}</td>
                            <td style="font-size: 13px; color: #1E40AF; padding: 8px; text-align: center;">${task.status || 'Planlandı'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // If no tasks
    if (totalTasks === 0) {
        return `
            <!DOCTYPE html>
            <html lang="tr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Analitik Günlük Bülten</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F8F9FE;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FE; padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table width="650" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                <tr>
                                    <td style="background-color: #F9FAFB; padding: 32px; text-align: center; border-bottom: 1px solid #E5E7EB;">
                                        <h1 style="margin: 0; color: #1F2937; font-size: 28px; font-weight: 700;">📈 Analitik Günlük Bülten</h1>
                                        <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 16px; font-weight: 500;">${dateStr}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 32px;">
                                        <p style="margin: 0 0 24px 0; font-size: 16px; color: #1F2937;">Günaydın <strong>${recipientName}</strong>,</p>
                                        <div style="background-color: #F0FDF4; border: 1px solid #86EFAC; border-radius: 8px; padding: 24px; text-align: center;">
                                            <p style="margin: 0; font-size: 18px; color: #166534; font-weight: 600;">
                                                🎉 Bugün için analitik işiniz yok!
                                            </p>
                                            <p style="margin: 12px 0 0 0; font-size: 14px; color: #15803D;">
                                                Harika bir gün geçirin!
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="background-color: #F9FAFB; padding: 24px; text-align: center; border-top: 1px solid #E5E7EB;">
                                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">Bu otomatik bir günlük bültendir.</p>
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

    return `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Analitik Günlük Bülten</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F8F9FE;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FE; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="650" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <tr>
                                <td style="background-color: #F9FAFB; padding: 32px; text-align: center; border-bottom: 1px solid #E5E7EB;">
                                    <h1 style="margin: 0; color: #1F2937; font-size: 28px; font-weight: 700;">📈 Analitik Günlük Bülten</h1>
                                    <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 16px; font-weight: 500;">${dateStr}</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 32px;">
                                    <p style="margin: 0 0 24px 0; font-size: 16px; color: #1F2937;">Günaydın <strong>${recipientName}</strong>,</p>
                                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">Bugün yapmanız gereken <strong>${totalTasks} analitik iş</strong> bulunmaktadır:</p>
                                    ${analyticsHTML}
                                    <div style="text-align: center; margin: 32px 0;">
                                        <a href="https://www.kampanyatakvimi.net.tr" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">Analitik Takvime Git →</a>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style="background-color: #F9FAFB; padding: 24px; text-align: center; border-top: 1px solid #E5E7EB;">
                                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">Bu otomatik bir günlük bültendir.</p>
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

// ===== BULLETIN LOCK & LOGGING =====

async function checkBulletinAlreadySent(db: Firestore, dateStr: string, userId: string): Promise<boolean> {
    try {
        const logsRef = db.collection('reminderLogs');
        const snapshot = await logsRef
            .where('eventId', '==', `analytics-bulletin-${dateStr}-${userId}`)
            .where('status', '==', 'success')
            .limit(1)
            .get();

        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking existing bulletin:', error);
        return false;
    }
}

async function logAnalyticsBulletin(db: Firestore, params: {
    recipientEmail: string;
    recipientName: string;
    userId: string;
    status: 'success' | 'failed';
    bulletinContent: AnalyticsBulletinContent;
    errorMessage?: string;
    messageId?: string;
}): Promise<void> {
    try {
        const dateStr = params.bulletinContent.date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        await db.collection('reminderLogs').add({
            eventId: `analytics-bulletin-${params.bulletinContent.date.toISOString().split('T')[0]}-${params.userId}`,
            eventType: 'analytics-bulletin',
            eventTitle: `Analitik Günlük Bülten - ${dateStr}`,
            recipientEmail: params.recipientEmail,
            recipientName: params.recipientName,
            urgency: 'Medium',
            sentAt: Timestamp.now(),
            status: params.status,
            errorMessage: params.errorMessage,
            emailProvider: 'resend',
            messageId: params.messageId,
            bulletinStats: {
                analyticsCount: params.bulletinContent.analyticsTasks.length,
            },
        });
    } catch (error) {
        console.error('Error logging analytics bulletin:', error);
    }
}

// ===== MAIN PROCESSOR =====

async function processAnalyticsBulletins(
    db: Firestore,
    analyticsTasks: AnalyticsTask[],
    analyticsUsers: AnalyticsUser[],
    settings: ReminderSettings
): Promise<ProcessResult> {
    const result: ProcessResult = { sent: 0, failed: 0, skipped: 0 };
    const now = new Date();

    console.log('=== ANALYTICS BULLETIN PROCESS START ===');
    console.log('analyticsDailyBulletinEnabled:', settings.analyticsDailyBulletinEnabled);
    console.log('analyticsDailyBulletinTime:', settings.analyticsDailyBulletinTime);
    console.log('recipientIds count:', settings.analyticsDailyBulletinRecipients?.length || 0);

    if (!settings.analyticsDailyBulletinEnabled) {
        console.log('❌ REASON: Analytics daily bulletin is disabled');
        return result;
    }

    if (!settings.analyticsDailyBulletinTime) {
        console.log('❌ REASON: No bulletin time configured');
        return result;
    }

    // Check if it's weekend
    const dayOfWeek = now.getDay();
    console.log('Day of week:', dayOfWeek, '(0=Sun, 6=Sat)');
    if (isWeekend(now)) {
        console.log('❌ REASON: Skipping bulletin - weekend');
        return result;
    }

    // Parse configured time (Turkey time - UTC+3)
    const [targetHour, targetMinute] = settings.analyticsDailyBulletinTime.split(':').map(Number);

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
        console.log('❌ REASON: Not time yet for bulletin');
        return result;
    }

    if (!settings.resendApiKey) {
        console.error('Resend API key is not configured');
        return result;
    }

    // Get recipients
    const recipientIds = settings.analyticsDailyBulletinRecipients || [];
    const recipients = analyticsUsers.filter(user =>
        recipientIds.includes(user.id) && user.email
    );

    if (recipients.length === 0) {
        console.log('No recipients configured');
        return result;
    }

    console.log(`Processing bulletins for ${recipients.length} users`);

    let emailsSentCount = 0;

    // Send bulletin to each user
    for (const user of recipients) {
        try {
            const todayStr = now.toISOString().split('T')[0];

            // Check if already sent today
            const alreadySent = await checkBulletinAlreadySent(db, todayStr, user.id);
            if (alreadySent) {
                console.log(`Bulletin already sent to ${user.name} today`);
                result.skipped++;
                continue;
            }

            // Build bulletin content for this user
            const bulletinContent = buildAnalyticsBulletin(
                analyticsTasks,
                user.id,
                now
            );

            // Skip if user has no tasks today
            const totalTasks = bulletinContent.analyticsTasks.length;

            if (totalTasks === 0) {
                console.log(`No analytics tasks for ${user.name} today, skipping`);
                result.skipped++;
                continue;
            }

            const html = buildAnalyticsBulletinHTML({
                recipientName: user.name,
                bulletinContent
            });

            const emailResult = await sendEmailInternal(
                settings.resendApiKey,
                {
                    to: user.email!,
                    subject: `📈 Analitik Günlük Bülten - ${now.toLocaleDateString('tr-TR')} (${totalTasks} İş)`,
                    html
                }
            );

            if (emailResult.success) {
                console.log(`✅ Sent to ${user.name}`);
                result.sent++;
                emailsSentCount++;

                await logAnalyticsBulletin(db, {
                    recipientEmail: user.email!,
                    recipientName: user.name,
                    userId: user.id,
                    status: 'success',
                    bulletinContent,
                    messageId: emailResult.messageId,
                });
            } else {
                console.error(`❌ Failed to send to ${user.name}: ${emailResult.error}`);
                result.failed++;

                await logAnalyticsBulletin(db, {
                    recipientEmail: user.email!,
                    recipientName: user.name,
                    userId: user.id,
                    status: 'failed',
                    bulletinContent,
                    errorMessage: emailResult.error,
                });
            }
        } catch (error) {
            console.error(`Error processing bulletin for ${user.name}:`, error);
            result.failed++;
        }
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
        console.log('Starting Analytics Daily Bulletin Cron Job...');

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

        if (!settings.analyticsDailyBulletinEnabled) {
            console.log('Analytics daily bulletin is disabled');
            return res.status(200).json({ status: 'skipped', reason: 'disabled' });
        }

        // Fetch Data (optimized with today's date filter)
        console.log('Fetching data...');

        const now = new Date();
        const turkeyTime = new Date(now.getTime() + TURKEY_OFFSET_MS);

        // Calculate Turkey's start/end of day in UTC for Firestore query
        const turkeyYear = turkeyTime.getUTCFullYear();
        const turkeyMonth = turkeyTime.getUTCMonth();
        const turkeyDate = turkeyTime.getUTCDate();

        const startOfDay = new Date(Date.UTC(turkeyYear, turkeyMonth, turkeyDate, 0, 0, 0) - TURKEY_OFFSET_MS);
        const endOfDay = new Date(Date.UTC(turkeyYear, turkeyMonth, turkeyDate, 23, 59, 59, 999) - TURKEY_OFFSET_MS);

        console.log('Turkey date:', `${turkeyYear}-${turkeyMonth + 1}-${turkeyDate}`);
        console.log('Query range (UTC):', startOfDay.toISOString(), '->', endOfDay.toISOString());

        // Fetch today's analytics tasks
        const analyticsSnapshot = await db.collection('analyticsTasks')
            .where('date', '>=', Timestamp.fromDate(startOfDay))
            .where('date', '<=', Timestamp.fromDate(endOfDay))
            .get();

        const analyticsTasks = analyticsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date?.toDate() || new Date(),
            };
        }) as AnalyticsTask[];

        // Fetch analytics users (only recipients)
        const recipientIds = settings.analyticsDailyBulletinRecipients || [];
        let analyticsUsers: AnalyticsUser[] = [];

        if (recipientIds.length > 0) {
            const userBatches = [];
            for (let i = 0; i < recipientIds.length; i += 10) {
                const batch = recipientIds.slice(i, i + 10);
                const snapshot = await db.collection('analyticsUsers')
                    .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                    .get();
                userBatches.push(...snapshot.docs);
            }
            analyticsUsers = userBatches.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as AnalyticsUser[];
        }

        console.log(`Found ${analyticsTasks.length} analytics tasks, ${analyticsUsers.length} users`);

        // Process
        const result = await processAnalyticsBulletins(
            db,
            analyticsTasks,
            analyticsUsers,
            settings
        );

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
