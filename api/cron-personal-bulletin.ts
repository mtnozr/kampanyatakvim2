/**
 * Vercel Cron Job for Personal Daily Bulletin
 * Full implementation with all dependencies inline
 *
 * Her kullanıcıya kendi kampanyalarını gönderir:
 * - Geciken kampanyalar (bugünden önce, tamamlanmamış)
 * - Bugünkü kampanyalar
 *
 * Pattern: cron-daily-digest.ts ile aynı yapı kullanılır.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

// ===== TYPE DEFINITIONS =====

interface ReminderSettings {
    resendApiKey?: string;
    personalBulletinEnabled?: boolean;
    personalBulletinTime?: string;
    personalBulletinRecipients?: string[]; // user IDs from 'users' collection
}

interface Campaign {
    id: string;
    title: string;
    date: Date;
    status: string;
    urgency: string;
    assigneeId?: string;
}

interface Report {
    id: string;
    title: string;
    campaignTitle?: string;
    dueDate: Date;
    status: string;
    assigneeId?: string;
}

interface User {
    id: string;
    name: string;
    email: string;
}

interface ProcessResult {
    sent: number;
    failed: number;
    skipped: number;
    alreadySent: number;
}

// ===== FIREBASE ADMIN INITIALIZATION =====

function initFirebaseAdmin() {
    if (!admin.apps.length) {
        try {
            const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

            if (!serviceAccountRaw) {
                throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
            }
            const normalizedRaw = serviceAccountRaw.trim().replace(/^FIREBASE_SERVICE_ACCOUNT=/, '');

            let serviceAccount;
            try {
                serviceAccount = JSON.parse(normalizedRaw);
            } catch (e) {
                throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON. Expected raw JSON object string.');
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

function getUrgencyLabel(urgency: string): string {
    const labels: Record<string, string> = {
        'Very High': 'Çok Yüksek',
        'High': 'Yüksek',
        'Medium': 'Orta',
        'Low': 'Düşük',
    };
    return labels[urgency] || urgency;
}

function isSameTurkeyDay(date: Date, year: number, month: number, day: number): boolean {
    const d = new Date(date.getTime() + TURKEY_OFFSET_MS);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day;
}

function isBeforeTurkeyDay(date: Date, year: number, month: number, day: number): boolean {
    const d = new Date(date.getTime() + TURKEY_OFFSET_MS);
    const campaignDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const todayDate = new Date(Date.UTC(year, month, day));
    return campaignDate < todayDate;
}

function isOverdueReport(report: Report, year: number, month: number, day: number): boolean {
    if (!report.assigneeId) return false;
    if (report.status === 'done' || report.status === 'cancelled') return false;
    return isBeforeTurkeyDay(report.dueDate, year, month, day);
}

function getReportDedupeKey(report: Pick<Report, 'title' | 'campaignTitle' | 'dueDate'>): string {
    const normalizedTitle = (report.title || '').trim().toLocaleLowerCase('tr-TR');
    const normalizedCampaign = (report.campaignTitle || '').trim().toLocaleLowerCase('tr-TR');
    const dueDate = report.dueDate;
    const dueDateKey = `${dueDate.getFullYear()}-${dueDate.getMonth() + 1}-${dueDate.getDate()}`;
    return `${normalizedTitle}|${normalizedCampaign}|${dueDateKey}`;
}

function dedupeOverdueReports(reports: Report[]): Report[] {
    const seen = new Set<string>();
    const unique: Report[] = [];

    for (const report of reports) {
        const key = getReportDedupeKey(report);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(report);
    }

    return unique;
}

// ===== EMAIL HTML BUILDER =====

function buildPersonalBulletinHTML(
    name: string,
    overdue: Campaign[],
    todayCampaigns: Campaign[],
    overdueReports: Report[],
    dateStr: string
): string {
    const overdueSection = overdue.length > 0 ? `
        <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #DC2626; font-weight: 600;">⚠️ Geciken Kampanyalar (${overdue.length})</h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #FEF2F2; border: 1px solid #DC2626; border-radius: 8px;">
                <thead>
                    <tr style="background-color: #FECACA;">
                        <th style="text-align: left; font-size: 12px; color: #991B1B; font-weight: 600; padding: 10px;">Kampanya</th>
                        <th style="text-align: center; font-size: 12px; color: #991B1B; font-weight: 600; padding: 10px;">Tarih</th>
                        <th style="text-align: center; font-size: 12px; color: #991B1B; font-weight: 600; padding: 10px;">Aciliyet</th>
                    </tr>
                </thead>
                <tbody>
                    ${overdue.map(c => `
                        <tr style="border-top: 1px solid #FCA5A5;">
                            <td style="padding: 10px; color: #991B1B;"><strong>${c.title}</strong></td>
                            <td style="padding: 10px; text-align: center; color: #991B1B;">${c.date.toLocaleDateString('tr-TR')}</td>
                            <td style="padding: 10px; text-align: center; color: #991B1B;">${getUrgencyLabel(c.urgency)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : `
        <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #10B981; font-weight: 600;">✅ Geciken Kampanya Yok</h3>
            <div style="background-color: #D1FAE5; border: 1px solid #10B981; border-radius: 8px; padding: 16px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #065F46;">Harika! Geciken kampanyanız bulunmuyor.</p>
            </div>
        </div>
    `;

    const todaySection = todayCampaigns.length > 0 ? `
        <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #7C3AED; font-weight: 600;">📅 Bugünkü Kampanyalar (${todayCampaigns.length})</h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #F5F3FF; border: 1px solid #7C3AED; border-radius: 8px;">
                <thead>
                    <tr style="background-color: #EDE9FE;">
                        <th style="text-align: left; font-size: 12px; color: #5B21B6; font-weight: 600; padding: 10px;">Kampanya</th>
                        <th style="text-align: center; font-size: 12px; color: #5B21B6; font-weight: 600; padding: 10px;">Aciliyet</th>
                        <th style="text-align: center; font-size: 12px; color: #5B21B6; font-weight: 600; padding: 10px;">Durum</th>
                    </tr>
                </thead>
                <tbody>
                    ${todayCampaigns.map(c => `
                        <tr style="border-top: 1px solid #C4B5FD;">
                            <td style="padding: 10px; color: #5B21B6;"><strong>${c.title}</strong></td>
                            <td style="padding: 10px; text-align: center; color: #5B21B6;">${getUrgencyLabel(c.urgency)}</td>
                            <td style="padding: 10px; text-align: center; color: #5B21B6;">${c.status || 'Planlandı'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : `
        <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #6B7280; font-weight: 600;">📅 Bugünkü Kampanyalar</h3>
            <div style="background-color: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 8px; padding: 16px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #4B5563;">Bugün için planlanmış kampanyanız bulunmuyor.</p>
            </div>
        </div>
    `;

    const overdueReportsSection = overdueReports.length > 0 ? `
        <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #B45309; font-weight: 600;">📝 Geciken Raporlar (${overdueReports.length})</h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #FFFBEB; border: 1px solid #D97706; border-radius: 8px;">
                <thead>
                    <tr style="background-color: #FEF3C7;">
                        <th style="text-align: left; font-size: 12px; color: #92400E; font-weight: 600; padding: 10px;">Rapor</th>
                        <th style="text-align: left; font-size: 12px; color: #92400E; font-weight: 600; padding: 10px;">Kampanya</th>
                        <th style="text-align: center; font-size: 12px; color: #92400E; font-weight: 600; padding: 10px;">Teslim Tarihi</th>
                    </tr>
                </thead>
                <tbody>
                    ${overdueReports.map(r => `
                        <tr style="border-top: 1px solid #FCD34D;">
                            <td style="padding: 10px; color: #92400E;"><strong>${r.title}</strong></td>
                            <td style="padding: 10px; color: #92400E;">${r.campaignTitle || '-'}</td>
                            <td style="padding: 10px; text-align: center; color: #92400E;">${r.dueDate.toLocaleDateString('tr-TR')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : `
        <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #10B981; font-weight: 600;">📝 Geciken Rapor Yok</h3>
            <div style="background-color: #D1FAE5; border: 1px solid #10B981; border-radius: 8px; padding: 16px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #065F46;">Teslim tarihi geçen raporunuz bulunmuyor.</p>
            </div>
        </div>
    `;

    const total = overdue.length + todayCampaigns.length;

    return `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Kişisel Günlük Bülten</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F8F9FE;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FE; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="650" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <tr>
                                <td style="background: linear-gradient(135deg, #7C3AED, #5B21B6); color: white; padding: 24px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 24px;">📋 Kişisel Günlük Bülten</h1>
                                    <p style="margin: 8px 0 0; opacity: 0.9;">${dateStr}</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 32px;">
                                    <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">Merhaba <strong>${name}</strong>,</p>
                                    <p style="margin: 0 0 24px; font-size: 14px; color: #6B7280; line-height: 1.6;">Bugün için toplam <strong>${total} kampanyanız</strong> bulunmaktadır.</p>
                                    ${overdueSection}
                                    ${todaySection}
                                    ${overdueReportsSection}
                                    <div style="text-align: center; margin-top: 24px;">
                                        <a href="https://www.kampanyatakvimi.net.tr" style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #4338CA 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3);">Takvime Git →</a>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style="background-color: #F9FAFB; padding: 16px; text-align: center; border-top: 1px solid #E5E7EB;">
                                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">Bu otomatik bir bildirimdir.</p>
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

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

// ===== DUPLICATE CHECK & LOCK =====

async function checkAlreadySentToday(db: Firestore, todayStr: string, userId: string): Promise<boolean> {
    try {
        const snapshot = await db.collection('reminderLogs')
            .where('eventId', '==', `personal-bulletin-${todayStr}-${userId}`)
            .where('status', '==', 'success')
            .get();
        return snapshot.size >= 1;
    } catch (error) {
        console.error('Error checking existing bulletin:', error);
        return false;
    }
}

async function acquirePersonalBulletinLock(db: Firestore, todayStr: string): Promise<boolean> {
    const lockRef = db.collection('systemLocks').doc(`personal-bulletin-${todayStr}`);

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

// ===== MAIN PROCESSOR =====

async function processPersonalBulletin(
    db: Firestore,
    allCampaigns: Campaign[],
    allReports: Report[],
    recipients: User[],
    settings: ReminderSettings,
    isForced: boolean
): Promise<ProcessResult> {
    const result: ProcessResult = { sent: 0, failed: 0, skipped: 0, alreadySent: 0 };
    const now = new Date();

    console.log('=== PERSONAL BULLETIN PROCESS START ===');
    console.log('personalBulletinEnabled:', settings.personalBulletinEnabled);
    console.log('personalBulletinTime:', settings.personalBulletinTime);
    console.log('recipients count:', recipients.length);

    if (!settings.personalBulletinEnabled) {
        console.log('❌ REASON: Personal bulletin is disabled');
        return result;
    }

    if (!settings.personalBulletinTime) {
        console.log('❌ REASON: No personal bulletin time configured');
        return result;
    }

    // Parse configured time (assumed to be in Turkey time - UTC+3)
    const [targetHour, targetMinute] = settings.personalBulletinTime.split(':').map(Number);

    // Convert server time (UTC) to Turkey time (UTC+3) - same pattern as daily-digest
    const turkeyTime = new Date(now.getTime() + TURKEY_OFFSET_MS);
    const currentHour = turkeyTime.getHours();
    const currentMinute = turkeyTime.getMinutes();
    const currentDay = turkeyTime.getDay(); // 0=Sunday, 6=Saturday

    console.log('Target time:', `${targetHour}:${targetMinute} Turkey`);
    console.log('Current time:', `${currentHour}:${currentMinute} Turkey`);
    console.log('Is forced:', isForced);

    if (!isForced) {
        // Weekend check
        if (currentDay === 0 || currentDay === 6) {
            console.log('❌ REASON: Weekend - skipping');
            return result;
        }

        // Time check: ±5 dakika penceresi (sadece ayarlanan saat civarında tetikle)
        const currentTotalMinutes = currentHour * 60 + currentMinute;
        const targetTotalMinutes = targetHour * 60 + targetMinute;
        const diff = Math.abs(currentTotalMinutes - targetTotalMinutes);
        const isTime = diff <= 5;
        console.log('Is time to send?', isTime, `(diff: ${diff} min)`);

        if (!isTime) {
            console.log('❌ REASON: Not time yet for personal bulletin');
            return result;
        }
    }

    // Duplicate check with lock (same pattern as daily-digest)
    const todayStr = now.toISOString().split('T')[0];

    // ⚠️ TEMP: Lock devre dışı - günde 10 gönderim testi için
    // if (!isForced) {
    //     const lockAcquired = await acquirePersonalBulletinLock(db, todayStr);
    //     if (!lockAcquired) {
    //         console.log('Could not acquire lock for personal bulletin (already processing or sent)');
    //         return result;
    //     }
    // }

    console.log('Processing personal bulletin...');

    if (!settings.resendApiKey) {
        console.error('Resend API key is not configured');
        return result;
    }

    // Get Turkey today for campaign filtering
    const turkeyYear = turkeyTime.getUTCFullYear();
    const turkeyMonth = turkeyTime.getUTCMonth();
    const turkeyDate = turkeyTime.getUTCDate();
    const turkeyDateStr = `${turkeyDate}.${turkeyMonth + 1}.${turkeyYear}`;

    console.log(`Turkey date: ${turkeyDateStr}`);
    console.log(`Total campaigns: ${allCampaigns.length}`);

    // Collect logs for batch write
    const logsToWrite: any[] = [];

    // Send to each recipient
    for (const user of recipients) {
        // Per-user duplicate check
        if (!isForced) {
            const alreadySentToUser = await checkAlreadySentToday(db, todayStr, user.id);
            if (alreadySentToUser) {
                console.log(`  ⏭️ ${user.name}: Already sent today, skipping`);
                result.alreadySent++;
                continue;
            }
        }

        // Filter campaigns for this user
        const userCampaigns = allCampaigns.filter(c => c.assigneeId === user.id);

        // Overdue campaigns: date < today AND only Planlandı
        const overdue = userCampaigns.filter(c =>
            isBeforeTurkeyDay(c.date, turkeyYear, turkeyMonth, turkeyDate) &&
            c.status === 'Planlandı'
        );

        // Today campaigns: date = today AND only Planlandı
        const todayCampaigns = userCampaigns.filter(c =>
            isSameTurkeyDay(c.date, turkeyYear, turkeyMonth, turkeyDate) &&
            c.status === 'Planlandı'
        );

        // Overdue reports for this user: dueDate < today AND report status not done/cancelled
        const overdueReportsRaw = allReports.filter(r =>
            r.assigneeId === user.id &&
            isOverdueReport(r, turkeyYear, turkeyMonth, turkeyDate)
        );
        const overdueReports = dedupeOverdueReports(overdueReportsRaw);

        console.log(`${user.name}: total=${userCampaigns.length}, overdue=${overdue.length}, today=${todayCampaigns.length}, overdueReports=${overdueReports.length}`);

        if (overdue.length === 0 && todayCampaigns.length === 0 && overdueReports.length === 0) {
            console.log(`  → No campaigns/reports, skipping`);
            result.skipped++;
            continue;
        }

        const html = buildPersonalBulletinHTML(user.name, overdue, todayCampaigns, overdueReports, turkeyDateStr);
        const total = overdue.length + todayCampaigns.length;
        const subject = `📋 Günlük Bülten - ${turkeyDateStr} (${total} Kampanya / ${overdueReports.length} Geciken Rapor${overdue.length > 0 || overdueReports.length > 0 ? ' ⚠️' : ''})`;

        const emailResult = await sendEmailInternal(settings.resendApiKey, {
            to: user.email,
            subject,
            html
        });

        if (emailResult.success) {
            console.log(`  ✅ Sent to ${user.name} (${user.email})`);
            result.sent++;

            logsToWrite.push({
                eventId: `personal-bulletin-${todayStr}-${user.id}`,
                recipientEmail: user.email,
                recipientName: user.name,
                status: 'success',
                messageId: emailResult.messageId,
                overdueCount: overdue.length,
                todayCount: todayCampaigns.length,
                overdueReportsCount: overdueReports.length,
            });
        } else {
            console.error(`  ❌ Failed to send to ${user.name}: ${emailResult.error}`);
            result.failed++;

            logsToWrite.push({
                eventId: `personal-bulletin-${todayStr}-${user.id}`,
                recipientEmail: user.email,
                recipientName: user.name,
                status: 'failed',
                errorMessage: emailResult.error,
                overdueCount: overdue.length,
                todayCount: todayCampaigns.length,
                overdueReportsCount: overdueReports.length,
            });
        }

        await sleep(600); // Resend rate limit: max 2 istek/sn
    }

    // Batch write all logs at once (saves Firestore writes)
    if (logsToWrite.length > 0) {
        console.log(`Writing ${logsToWrite.length} logs in batch...`);
        const batch = db.batch();
        for (const logData of logsToWrite) {
            const logRef = db.collection('reminderLogs').doc();
            const logEntry: Record<string, any> = {
                eventId: logData.eventId,
                eventType: 'personal-bulletin',
                eventTitle: `Kişisel Günlük Bülten - ${turkeyDateStr}`,
                recipientEmail: logData.recipientEmail,
                recipientName: logData.recipientName,
                urgency: 'Medium',
                sentAt: Timestamp.now(),
                status: logData.status,
                emailProvider: 'resend',
                bulletinStats: {
                    overdueCount: logData.overdueCount,
                    todayCount: logData.todayCount,
                    overdueReportsCount: logData.overdueReportsCount || 0,
                },
            };
            if (logData.errorMessage) logEntry.errorMessage = logData.errorMessage;
            if (logData.messageId) logEntry.messageId = logData.messageId;
            batch.set(logRef, logEntry);
        }
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
    // Verify Authorization - same pattern as daily-digest
    const authHeader = req.headers.authorization?.trim();
    const queryKeyRaw = Array.isArray(req.query.key) ? req.query.key[0] : req.query.key;
    const queryKey = typeof queryKeyRaw === 'string' ? queryKeyRaw.trim() : undefined;
    const expectedKey = process.env.CRON_SECRET_KEY?.trim();
    const expectedBearer = process.env.CRON_SECRET?.trim();

    const hasQuerySecretConfigured = Boolean(expectedKey);
    const hasBearerSecretConfigured = Boolean(expectedBearer);

    if (!hasQuerySecretConfigured && !hasBearerSecretConfigured) {
        console.error('Cron auth misconfigured: set CRON_SECRET_KEY and/or CRON_SECRET in environment variables.');
        return res.status(500).json({ error: 'Cron auth is not configured' });
    }

    const queryAuthorized = hasQuerySecretConfigured && queryKey === expectedKey;
    const bearerAuthorized = hasBearerSecretConfigured && authHeader === `Bearer ${expectedBearer}`;

    if (!queryAuthorized && !bearerAuthorized) {
        console.warn('Unauthorized cron request');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // force=true bypasses time/weekend/lock checks (for manual triggers)
    const forceParam = Array.isArray(req.query.force) ? req.query.force[0] : req.query.force;
    const isForced = forceParam === 'true';

    try {
        console.log('Starting Personal Bulletin Cron Job...');
        if (isForced) console.log('⚡ Forced mode - bypassing time/weekend/lock checks');

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

        if (!settings.personalBulletinEnabled) {
            console.log('Personal bulletin is disabled');
            return res.status(200).json({ success: false, reason: 'disabled' });
        }

        if (!settings.personalBulletinTime) {
            console.log('No personal bulletin time configured');
            return res.status(200).json({ success: false, reason: 'no_time_set' });
        }

        // Fetch Data
        console.log('Fetching data...');

        // Fetch ALL campaigns (we need overdue ones too, not just today's)
        const campaignsSnapshot = await db.collection('events').get();
        const allCampaigns: Campaign[] = campaignsSnapshot.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                title: d.title || '',
                date: d.date?.toDate() || new Date(),
                status: d.status || 'Planlandı',
                urgency: d.urgency || 'Medium',
                assigneeId: d.assigneeId
            };
        });

        console.log(`Fetched ${allCampaigns.length} campaigns`);

        // Fetch reports for overdue report section
        const reportsSnapshot = await db.collection('reports').get();
        const allReports: Report[] = reportsSnapshot.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                title: d.title || '',
                campaignTitle: d.campaignTitle || '',
                dueDate: d.dueDate?.toDate() || new Date(),
                status: d.status || 'pending',
                assigneeId: d.assigneeId
            };
        });

        console.log(`Fetched ${allReports.length} reports`);

        // Fetch recipients
        const recipientIds = settings.personalBulletinRecipients || [];

        if (recipientIds.length === 0) {
            console.log('No recipients configured');
            return res.status(200).json({ success: false, reason: 'no_recipients' });
        }

        // Batch fetch users (max 10 per 'in' query)
        let recipients: User[] = [];
        for (let i = 0; i < recipientIds.length; i += 10) {
            const batch = recipientIds.slice(i, i + 10);
            const snapshot = await db.collection('users')
                .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                .get();
            recipients.push(...snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name || 'İsimsiz',
                email: doc.data().email || ''
            })));
        }

        // Filter out users without email
        recipients = recipients.filter(u => u.email);
        console.log(`Fetched ${recipients.length} recipients with email`);

        if (recipients.length === 0) {
            console.log('No recipients with email found');
            return res.status(200).json({ success: false, reason: 'no_valid_recipients' });
        }

        // Process
        console.log('Processing bulletin...');
        const result = await processPersonalBulletin(db, allCampaigns, allReports, recipients, settings, isForced);

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
