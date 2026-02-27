/**
 * Vercel Cron Job for Morning Bulletin
 * Full implementation with all dependencies inline
 *
 * Her sabah ekibe gönderilir:
 * - Geciken kampanyalar (bugünden önce, tamamlanmamış)
 * - Bugünkü kampanyalar
 * - Bu haftaki yaklaşan kampanyalar (yarından itibaren, 7 gün)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

// ===== TYPE DEFINITIONS =====

interface ReminderSettings {
    resendApiKey?: string;
    morningBulletinEnabled?: boolean;
    morningBulletinTime?: string;
    emailCcRecipients?: string[];
}

interface CalendarEvent {
    id: string;
    title: string;
    date: Date;
    status: string;
    urgency: string;
    assigneeId?: string;
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

interface MorningCampaignDetails {
    id: string;
    title: string;
    assigneeName: string;
    date: Date;
    urgencyLabel: string;
}

interface MorningTodayCampaignDetails {
    id: string;
    title: string;
    assigneeName: string;
    urgencyLabel: string;
    status: string;
}

interface MorningBulletinContent {
    overdueCampaigns: MorningCampaignDetails[];
    todayCampaigns: MorningTodayCampaignDetails[];
    upcomingCampaigns: MorningCampaignDetails[];
    date: Date;
    totalOverdue: number;
    totalToday: number;
    totalUpcoming: number;
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

// ===== MORNING BULLETIN BUILDER =====

function buildMorningBulletin(
    overdue: CalendarEvent[],
    today: CalendarEvent[],
    upcoming: CalendarEvent[],
    users: User[],
    targetDate: Date = new Date()
): MorningBulletinContent {
    const overdueCampaigns: MorningCampaignDetails[] = overdue.map(c => ({
        id: c.id,
        title: c.title,
        assigneeName: getUserName(c.assigneeId, users),
        date: c.date,
        urgencyLabel: getUrgencyLabel(c.urgency),
    }));

    const todayCampaigns: MorningTodayCampaignDetails[] = today.map(c => ({
        id: c.id,
        title: c.title,
        assigneeName: getUserName(c.assigneeId, users),
        urgencyLabel: getUrgencyLabel(c.urgency),
        status: c.status || 'Planlandı',
    }));

    const upcomingCampaigns: MorningCampaignDetails[] = upcoming.map(c => ({
        id: c.id,
        title: c.title,
        assigneeName: getUserName(c.assigneeId, users),
        date: c.date,
        urgencyLabel: getUrgencyLabel(c.urgency),
    }));

    return {
        overdueCampaigns,
        todayCampaigns,
        upcomingCampaigns,
        date: targetDate,
        totalOverdue: overdueCampaigns.length,
        totalToday: todayCampaigns.length,
        totalUpcoming: upcomingCampaigns.length,
    };
}

// ===== EMAIL HTML BUILDER =====

function buildMorningBulletinHTML(params: {
    recipientName: string;
    content: MorningBulletinContent;
}): string {
    const { recipientName, content } = params;

    const dateStr = content.date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long',
    });

    // ── Summary boxes ──
    const summaryHTML = `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
            <tr>
                <td width="33%" style="padding-right: 6px;">
                    <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 10px; padding: 16px; text-align: center;">
                        <p style="margin: 0; font-size: 28px; font-weight: 700; color: #92400E;">${content.totalToday}</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #78350F; font-weight: 600;">Bugün</p>
                    </div>
                </td>
                <td width="33%" style="padding: 0 3px;">
                    <div style="background: #FEE2E2; border: 1px solid #EF4444; border-radius: 10px; padding: 16px; text-align: center;">
                        <p style="margin: 0; font-size: 28px; font-weight: 700; color: #991B1B;">${content.totalOverdue}</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #7F1D1D; font-weight: 600;">Geciken</p>
                    </div>
                </td>
                <td width="33%" style="padding-left: 6px;">
                    <div style="background: #EFF6FF; border: 1px solid #3B82F6; border-radius: 10px; padding: 16px; text-align: center;">
                        <p style="margin: 0; font-size: 28px; font-weight: 700; color: #1E40AF;">${content.totalUpcoming}</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #1E3A8A; font-weight: 600;">Bu Hafta</p>
                    </div>
                </td>
            </tr>
        </table>
    `;

    // ── Overdue section ──
    let overdueHTML = '';
    if (content.totalOverdue > 0) {
        overdueHTML = `
            <h3 style="margin: 24px 0 12px 0; font-size: 17px; color: #DC2626; font-weight: 700;">
                ⚠️ Geciken Kampanyalar (${content.totalOverdue})
            </h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #FEF2F2; border: 1px solid #EF4444; border-radius: 8px; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #FECACA;">
                        <th style="text-align: left; font-size: 12px; color: #991B1B; font-weight: 600; padding: 10px 12px;">Kampanya</th>
                        <th style="text-align: left; font-size: 12px; color: #991B1B; font-weight: 600; padding: 10px 12px;">Atanan</th>
                        <th style="text-align: center; font-size: 12px; color: #991B1B; font-weight: 600; padding: 10px 12px;">Tarih</th>
                        <th style="text-align: center; font-size: 12px; color: #991B1B; font-weight: 600; padding: 10px 12px;">Aciliyet</th>
                    </tr>
                </thead>
                <tbody>
                    ${content.overdueCampaigns.map(c => `
                        <tr style="border-top: 1px solid #FCA5A5;">
                            <td style="font-size: 13px; color: #7F1D1D; padding: 10px 12px;"><strong>${c.title}</strong></td>
                            <td style="font-size: 13px; color: #7F1D1D; padding: 10px 12px;">${c.assigneeName}</td>
                            <td style="font-size: 13px; color: #7F1D1D; padding: 10px 12px; text-align: center;">${c.date.toLocaleDateString('tr-TR')}</td>
                            <td style="font-size: 13px; color: #7F1D1D; padding: 10px 12px; text-align: center;">${c.urgencyLabel}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        overdueHTML = `
            <h3 style="margin: 24px 0 12px 0; font-size: 17px; color: #10B981; font-weight: 700;">
                ✅ Geciken Kampanya Yok
            </h3>
            <div style="background-color: #D1FAE5; border: 1px solid #10B981; border-radius: 8px; padding: 14px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; font-size: 13px; color: #065F46;">Harika! Geciken kampanya bulunmuyor.</p>
            </div>
        `;
    }

    // ── Today section ──
    let todayHTML = '';
    if (content.totalToday > 0) {
        todayHTML = `
            <h3 style="margin: 0 0 12px 0; font-size: 17px; color: #D97706; font-weight: 700;">
                📅 Bugünkü Kampanyalar (${content.totalToday})
            </h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #FFFBEB; border: 1px solid #F59E0B; border-radius: 8px; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #FEF3C7;">
                        <th style="text-align: left; font-size: 12px; color: #92400E; font-weight: 600; padding: 10px 12px;">Kampanya</th>
                        <th style="text-align: left; font-size: 12px; color: #92400E; font-weight: 600; padding: 10px 12px;">Atanan</th>
                        <th style="text-align: center; font-size: 12px; color: #92400E; font-weight: 600; padding: 10px 12px;">Aciliyet</th>
                        <th style="text-align: center; font-size: 12px; color: #92400E; font-weight: 600; padding: 10px 12px;">Durum</th>
                    </tr>
                </thead>
                <tbody>
                    ${content.todayCampaigns.map(c => `
                        <tr style="border-top: 1px solid #FDE68A;">
                            <td style="font-size: 13px; color: #78350F; padding: 10px 12px;"><strong>${c.title}</strong></td>
                            <td style="font-size: 13px; color: #78350F; padding: 10px 12px;">${c.assigneeName}</td>
                            <td style="font-size: 13px; color: #78350F; padding: 10px 12px; text-align: center;">${c.urgencyLabel}</td>
                            <td style="font-size: 13px; color: #78350F; padding: 10px 12px; text-align: center;">${c.status}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        todayHTML = `
            <h3 style="margin: 0 0 12px 0; font-size: 17px; color: #6B7280; font-weight: 700;">
                📅 Bugünkü Kampanyalar
            </h3>
            <div style="background-color: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 8px; padding: 14px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; font-size: 13px; color: #4B5563;">Bugün için planlanmış kampanya bulunmuyor.</p>
            </div>
        `;
    }

    // ── Upcoming section ──
    let upcomingHTML = '';
    if (content.totalUpcoming > 0) {
        upcomingHTML = `
            <h3 style="margin: 0 0 12px 0; font-size: 17px; color: #2563EB; font-weight: 700;">
                🗓️ Bu Haftaki Yaklaşan Kampanyalar (${content.totalUpcoming})
            </h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #EFF6FF; border: 1px solid #3B82F6; border-radius: 8px; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #DBEAFE;">
                        <th style="text-align: left; font-size: 12px; color: #1E40AF; font-weight: 600; padding: 10px 12px;">Kampanya</th>
                        <th style="text-align: left; font-size: 12px; color: #1E40AF; font-weight: 600; padding: 10px 12px;">Atanan</th>
                        <th style="text-align: center; font-size: 12px; color: #1E40AF; font-weight: 600; padding: 10px 12px;">Tarih</th>
                        <th style="text-align: center; font-size: 12px; color: #1E40AF; font-weight: 600; padding: 10px 12px;">Aciliyet</th>
                    </tr>
                </thead>
                <tbody>
                    ${content.upcomingCampaigns.map(c => `
                        <tr style="border-top: 1px solid #BFDBFE;">
                            <td style="font-size: 13px; color: #1E3A8A; padding: 10px 12px;"><strong>${c.title}</strong></td>
                            <td style="font-size: 13px; color: #1E3A8A; padding: 10px 12px;">${c.assigneeName}</td>
                            <td style="font-size: 13px; color: #1E3A8A; padding: 10px 12px; text-align: center;">${c.date.toLocaleDateString('tr-TR')}</td>
                            <td style="font-size: 13px; color: #1E3A8A; padding: 10px 12px; text-align: center;">${c.urgencyLabel}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        upcomingHTML = `
            <h3 style="margin: 0 0 12px 0; font-size: 17px; color: #6B7280; font-weight: 700;">
                🗓️ Bu Haftaki Yaklaşan Kampanyalar
            </h3>
            <div style="background-color: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 8px; padding: 14px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; font-size: 13px; color: #4B5563;">Bu hafta için başka kampanya planlanmamış.</p>
            </div>
        `;
    }

    return `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sabah Bülteni</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #FFFBEB;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFFBEB; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="650" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <tr>
                                <td style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 32px; text-align: center; border-bottom: 1px solid #E5E7EB;">
                                    <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,0.15);">☀️ Sabah Bülteni</h1>
                                    <p style="margin: 8px 0 0 0; color: #FEF3C7; font-size: 16px; font-weight: 500;">${dateStr}</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 32px;">
                                    <p style="margin: 0 0 24px 0; font-size: 16px; color: #1F2937;">Günaydın <strong>${recipientName}</strong>,</p>
                                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">Bugün için ekip kampanya durumu aşağıdadır:</p>
                                    ${summaryHTML}
                                    ${overdueHTML}
                                    ${todayHTML}
                                    ${upcomingHTML}
                                    <div style="text-align: center; margin: 32px 0;">
                                        <a href="https://www.kampanyatakvimi.net.tr" style="display: inline-block; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(217, 119, 6, 0.3);">Takvime Git →</a>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style="background-color: #FEF3C7; padding: 24px; text-align: center; border-top: 1px solid #FDE68A;">
                                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #78350F;">Bu otomatik bir sabah özetidir.</p>
                                    <p style="margin: 0; font-size: 12px; color: #92400E;">Kampanya Takvimi © ${new Date().getFullYear()}</p>
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

async function checkBulletinAlreadySent(db: Firestore, dateStr: string, recipientId: string): Promise<boolean> {
    try {
        const snapshot = await db.collection('reminderLogs')
            .where('eventId', '==', `morning-bulletin-${dateStr}-${recipientId}`)
            .where('status', '==', 'success')
            .limit(1)
            .get();
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking existing bulletin:', error);
        return false;
    }
}

async function acquireMorningBulletinLock(db: Firestore, dateStr: string): Promise<boolean> {
    const lockRef = db.collection('systemLocks').doc(`morning-bulletin-${dateStr}`);
    try {
        return await db.runTransaction(async (transaction) => {
            const lockDoc = await transaction.get(lockRef);
            if (lockDoc.exists) return false;
            transaction.set(lockRef, { createdAt: Timestamp.now(), status: 'processing' });
            return true;
        });
    } catch (error) {
        console.error('Error acquiring lock:', error);
        return false;
    }
}

// ===== MAIN PROCESSOR =====

async function processMorningBulletin(
    db: Firestore,
    overdueCampaigns: CalendarEvent[],
    todayCampaigns: CalendarEvent[],
    upcomingCampaigns: CalendarEvent[],
    users: User[],
    departmentUsers: DepartmentUser[],
    settings: ReminderSettings
): Promise<ProcessResult> {
    const result: ProcessResult = { sent: 0, failed: 0, skipped: 0 };
    const now = new Date();

    console.log('=== MORNING BULLETIN PROCESS START ===');
    console.log('morningBulletinEnabled:', settings.morningBulletinEnabled);
    console.log('morningBulletinTime:', settings.morningBulletinTime);
    console.log('emailCcRecipients count:', settings.emailCcRecipients?.length || 0);

    if (!settings.morningBulletinEnabled) {
        console.log('❌ REASON: Morning bulletin is disabled');
        return result;
    }

    if (!settings.morningBulletinTime) {
        console.log('❌ REASON: No morning bulletin time configured');
        return result;
    }

    // Parse configured time (Turkey time - UTC+3)
    const [targetHour, targetMinute] = settings.morningBulletinTime.split(':').map(Number);

    const turkeyTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    const currentDay = turkeyTime.getDay();
    const currentHour = turkeyTime.getHours();
    const currentMinute = turkeyTime.getMinutes();

    console.log('Target time:', `${targetHour}:${String(targetMinute).padStart(2, '0')} Turkey`);
    console.log('Current time:', `${currentHour}:${String(currentMinute).padStart(2, '0')} Turkey`);
    console.log('Day of week:', currentDay, '(0=Sun, 6=Sat)');

    // Skip weekends
    if (currentDay === 0 || currentDay === 6) {
        console.log('❌ REASON: Weekend - skipping morning bulletin');
        return result;
    }

    // ±5 dakika penceresi
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const targetTotalMinutes = targetHour * 60 + targetMinute;
    const diff = Math.abs(currentTotalMinutes - targetTotalMinutes);
    const isTime = diff <= 5;

    console.log('Is time to send?', isTime, `(diff: ${diff} min)`);
    if (!isTime) {
        console.log('❌ REASON: Not time yet for morning bulletin');
        return result;
    }

    const todayStr = now.toISOString().split('T')[0];

    // ⚠️ TEMP: Lock devre dışı - günde 10 gönderim testi için
    // const lockAcquired = await acquireMorningBulletinLock(db, todayStr);
    // if (!lockAcquired) {
    //     console.log('Could not acquire lock for morning bulletin');
    //     return result;
    // }

    console.log('Processing morning bulletin...');

    if (!settings.resendApiKey) {
        console.error('Resend API key is not configured');
        return result;
    }

    // Build bulletin content
    const bulletinContent = buildMorningBulletin(overdueCampaigns, todayCampaigns, upcomingCampaigns, users, now);

    // Günsonu bültetiyle aynı mantık: emailCcRecipients içinde olan ve isDesigner olan kullanıcılar
    const recipients = departmentUsers.filter(user => {
        const isSelected = (settings.emailCcRecipients || []).includes(user.id);
        return user.isDesigner && user.email && isSelected;
    });

    if (recipients.length === 0) {
        console.log('No recipients found');
        return result;
    }

    console.log(`Sending to ${recipients.length} recipients`);

    // Collect logs and batch write at the end
    const logsToWrite: any[] = [];

    for (const recipient of recipients) {
        // Per-recipient duplicate check
        const alreadySent = await checkBulletinAlreadySent(db, todayStr, recipient.id);
        if (alreadySent) {
            console.log(`⏭️ Already sent to ${recipient.name || recipient.username} today, skipping`);
            result.skipped++;
            continue;
        }

        try {
            const html = buildMorningBulletinHTML({
                recipientName: recipient.name || recipient.username,
                content: bulletinContent,
            });

            const emailResult = await sendEmailInternal(settings.resendApiKey, {
                to: recipient.email!,
                subject: `☀️ Sabah Bülteni - ${now.toLocaleDateString('tr-TR')}`,
                html,
            });

            if (emailResult.success) {
                console.log(`✅ Sent to ${recipient.name || recipient.username}`);
                result.sent++;
                logsToWrite.push({
                    recipientId: recipient.id,
                    recipientEmail: recipient.email!,
                    recipientName: recipient.name || recipient.username,
                    status: 'success',
                    messageId: emailResult.messageId,
                });
            } else {
                console.error(`❌ Failed to send to ${recipient.name || recipient.username}: ${emailResult.error}`);
                result.failed++;
                logsToWrite.push({
                    recipientId: recipient.id,
                    recipientEmail: recipient.email!,
                    recipientName: recipient.name || recipient.username,
                    status: 'failed',
                    errorMessage: emailResult.error,
                });
            }
        } catch (error) {
            console.error(`Error sending to ${recipient.name || recipient.username}:`, error);
            result.failed++;
            logsToWrite.push({
                recipientId: recipient.id,
                recipientEmail: recipient.email!,
                recipientName: recipient.name || recipient.username,
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    // Batch write all logs at once
    console.log(`Writing ${logsToWrite.length} logs in batch...`);
    if (logsToWrite.length > 0) {
        const dateLabel = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        const batch = db.batch();
        for (const logData of logsToWrite) {
            const logRef = db.collection('reminderLogs').doc();
            const logEntry: Record<string, any> = {
                eventId: `morning-bulletin-${todayStr}-${logData.recipientId}`,
                eventType: 'morning-bulletin',
                eventTitle: `Sabah Bülteni - ${dateLabel}`,
                recipientEmail: logData.recipientEmail,
                recipientName: logData.recipientName,
                urgency: 'Medium',
                sentAt: Timestamp.now(),
                status: logData.status,
                emailProvider: 'resend',
                bulletinStats: {
                    overdueCount: bulletinContent.totalOverdue,
                    todayCount: bulletinContent.totalToday,
                    upcomingCount: bulletinContent.totalUpcoming,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Authorization
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

    try {
        console.log('Starting Morning Bulletin Cron Job...');

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

        if (!settings.morningBulletinEnabled) {
            console.log('Morning bulletin is disabled');
            return res.status(200).json({ status: 'skipped', reason: 'disabled' });
        }

        if (!settings.morningBulletinTime) {
            console.log('No morning bulletin time configured');
            return res.status(200).json({ status: 'skipped', reason: 'no_time_set' });
        }

        // Fetch data
        console.log('Fetching data...');

        const now = new Date();
        const turkeyTime = new Date(now.getTime() + TURKEY_OFFSET_MS);
        const turkeyYear = turkeyTime.getUTCFullYear();
        const turkeyMonth = turkeyTime.getUTCMonth();
        const turkeyDate = turkeyTime.getUTCDate();

        // Turkey day boundaries in UTC
        const startOfToday = new Date(Date.UTC(turkeyYear, turkeyMonth, turkeyDate, 0, 0, 0) - TURKEY_OFFSET_MS);
        const endOfToday   = new Date(Date.UTC(turkeyYear, turkeyMonth, turkeyDate, 23, 59, 59, 999) - TURKEY_OFFSET_MS);
        const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        const endOfWeek    = new Date(startOfToday.getTime() + 8 * 24 * 60 * 60 * 1000 - 1);

        // OPTIMIZATION: 3 targeted queries instead of full collection scan

        // 1. Geciken kampanyalar: date < bugün AND Planlandı veya Devam Ediyor
        const overdueSnap = await db.collection('events')
            .where('date', '<', Timestamp.fromDate(startOfToday))
            .where('status', 'in', ['Planlandı', 'Devam Ediyor'])
            .get();

        // 2. Bugünkü kampanyalar
        const todaySnap = await db.collection('events')
            .where('date', '>=', Timestamp.fromDate(startOfToday))
            .where('date', '<=', Timestamp.fromDate(endOfToday))
            .get();

        // 3. Yaklaşan kampanyalar (yarından itibaren 7 gün)
        const upcomingSnap = await db.collection('events')
            .where('date', '>', Timestamp.fromDate(endOfToday))
            .where('date', '<=', Timestamp.fromDate(endOfWeek))
            .get();

        const toEvent = (doc: FirebaseFirestore.QueryDocumentSnapshot): CalendarEvent => {
            const d = doc.data();
            return {
                id: doc.id,
                title: d.title || '',
                date: d.date?.toDate() || new Date(),
                status: d.status || '',
                urgency: d.urgency || 'Medium',
                assigneeId: d.assigneeId,
            };
        };

        const overdueCampaigns = overdueSnap.docs.map(toEvent);
        const todayCampaigns = todaySnap.docs
            .map(toEvent)
            .filter(c => c.status !== 'İptal Edildi');
        const upcomingCampaigns = upcomingSnap.docs
            .map(toEvent)
            .filter(c => c.status !== 'İptal Edildi' && c.status !== 'Tamamlandı');

        console.log(`Overdue: ${overdueCampaigns.length} | Today: ${todayCampaigns.length} | Upcoming: ${upcomingCampaigns.length}`);

        // Fetch user names for assignees
        const allAssigneeIds = [...new Set([
            ...overdueCampaigns.map(c => c.assigneeId),
            ...todayCampaigns.map(c => c.assigneeId),
            ...upcomingCampaigns.map(c => c.assigneeId),
        ].filter(Boolean) as string[])];

        let users: User[] = [];
        if (allAssigneeIds.length > 0) {
            const userBatches: FirebaseFirestore.QueryDocumentSnapshot[] = [];
            for (let i = 0; i < allAssigneeIds.length; i += 10) {
                const batch = allAssigneeIds.slice(i, i + 10);
                const snap = await db.collection('users')
                    .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                    .get();
                userBatches.push(...snap.docs);
            }
            users = userBatches.map(doc => ({ id: doc.id, ...doc.data() } as User));
            console.log(`Fetched ${users.length} assigned users`);
        }

        // OPTIMIZATION: Only fetch department users in emailCcRecipients list
        const recipientIds = settings.emailCcRecipients || [];
        let deptUsers: DepartmentUser[] = [];

        if (recipientIds.length > 0) {
            const deptUserBatches: FirebaseFirestore.QueryDocumentSnapshot[] = [];
            for (let i = 0; i < recipientIds.length; i += 10) {
                const batch = recipientIds.slice(i, i + 10);
                const snap = await db.collection('departmentUsers')
                    .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                    .get();
                deptUserBatches.push(...snap.docs);
            }
            deptUsers = deptUserBatches.map(doc => ({ id: doc.id, ...doc.data() } as DepartmentUser));
            console.log(`Fetched ${deptUsers.length} department users`);
        }

        // Process
        console.log('Processing morning bulletin...');
        const result = await processMorningBulletin(
            db,
            overdueCampaigns,
            todayCampaigns,
            upcomingCampaigns,
            users,
            deptUsers,
            settings
        );

        return res.status(200).json({ success: true, result });

    } catch (error) {
        console.error('Cron job error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
