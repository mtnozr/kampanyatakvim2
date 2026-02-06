/**
 * Vercel Cron Job for Weekly Digest
 * Full implementation with all dependencies inline
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

// ===== TYPE DEFINITIONS =====

interface ReminderSettings {
    resendApiKey?: string;
    weeklyDigestEnabled?: boolean;
    weeklyDigestDay?: number; // 0=Sunday, 1=Monday, etc.
    weeklyDigestTime?: string;
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

interface Report {
    id: string;
    title: string;
    campaignTitle?: string;
    dueDate: Date;
    status: string;
    assigneeId?: string;
}

interface ReportWithDetails {
    id: string;
    title: string;
    campaignTitle?: string;
    dueDate: Date;
    daysOverdue: number;
    assigneeId?: string;
    assigneeName: string;
}

interface CampaignWithDetails {
    id: string;
    title: string;
    date: Date;
    urgency: string;
    urgencyLabel: string;
    assigneeId?: string;
    assigneeName: string;
    status?: string;
}

interface DigestContent {
    overdueReports: ReportWithDetails[];
    thisWeekCampaigns: CampaignWithDetails[];
    weekStart: Date;
    weekEnd: Date;
    totalOverdueReports: number;
    totalThisWeekCampaigns: number;
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

function startOfWeek(date: Date): Date {
    // Calculate in Turkey timezone
    const turkeyTime = new Date(date.getTime() + TURKEY_OFFSET_MS);
    const day = turkeyTime.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day; // Monday = 1
    const turkeyYear = turkeyTime.getUTCFullYear();
    const turkeyMonth = turkeyTime.getUTCMonth();
    const turkeyDate = turkeyTime.getUTCDate() + diff;
    // Return Turkey Monday 00:00:00 as UTC
    return new Date(Date.UTC(turkeyYear, turkeyMonth, turkeyDate, 0, 0, 0) - TURKEY_OFFSET_MS);
}

function endOfWeek(date: Date): Date {
    const start = startOfWeek(date);
    // Add 6 days + 23:59:59.999 in Turkey time
    const turkeyStart = new Date(start.getTime() + TURKEY_OFFSET_MS);
    const turkeyYear = turkeyStart.getUTCFullYear();
    const turkeyMonth = turkeyStart.getUTCMonth();
    const turkeyDate = turkeyStart.getUTCDate() + 6; // Sunday
    // Return Turkey Sunday 23:59:59.999 as UTC
    return new Date(Date.UTC(turkeyYear, turkeyMonth, turkeyDate, 23, 59, 59, 999) - TURKEY_OFFSET_MS);
}

function isBefore(date1: Date, date2: Date): boolean {
    return date1.getTime() < date2.getTime();
}

function isWithinInterval(date: Date, interval: { start: Date; end: Date }): boolean {
    return date.getTime() >= interval.start.getTime() &&
           date.getTime() <= interval.end.getTime();
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

// ===== WEEKLY DIGEST BUILDER =====

function buildWeeklyDigest(
    reports: Report[],
    campaigns: CalendarEvent[],
    users: User[],
    referenceDate: Date = new Date()
): DigestContent {
    const now = referenceDate;

    // Calculate week range (Monday-Sunday)
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    // Find overdue reports
    const overdueReports: ReportWithDetails[] = reports
        .filter(report => {
            return report.status === 'pending' && isBefore(report.dueDate, now);
        })
        .map(report => {
            const daysOverdue = Math.floor(
                (now.getTime() - report.dueDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            return {
                id: report.id,
                title: report.title,
                campaignTitle: report.campaignTitle,
                dueDate: report.dueDate,
                daysOverdue,
                assigneeId: report.assigneeId,
                assigneeName: getUserName(report.assigneeId, users),
            };
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Find this week's campaigns
    const thisWeekCampaigns: CampaignWithDetails[] = campaigns
        .filter(campaign => {
            if (campaign.status === 'İptal Edildi') return false;
            return isWithinInterval(campaign.date, {
                start: weekStart,
                end: weekEnd,
            });
        })
        .map(campaign => ({
            id: campaign.id,
            title: campaign.title,
            date: campaign.date,
            urgency: campaign.urgency,
            urgencyLabel: getUrgencyLabel(campaign.urgency),
            assigneeId: campaign.assigneeId,
            assigneeName: getUserName(campaign.assigneeId, users),
            status: campaign.status,
        }))
        .sort((a, b) => {
            if (a.date.getTime() !== b.date.getTime()) {
                return a.date.getTime() - b.date.getTime();
            }
            const urgencyOrder = { 'Very High': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
            return (urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 99) -
                (urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 99);
        });

    return {
        overdueReports,
        thisWeekCampaigns,
        weekStart,
        weekEnd,
        totalOverdueReports: overdueReports.length,
        totalThisWeekCampaigns: thisWeekCampaigns.length,
    };
}

// ===== EMAIL HTML BUILDER =====

function buildWeeklyDigestHTML(params: {
    recipientName: string;
    digestContent: DigestContent;
}): string {
    const { recipientName, digestContent } = params;
    const { weekStart, weekEnd } = digestContent;

    const weekRangeStr = `${weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} - ${weekEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    // Build overdue reports table
    let overdueReportsHTML = '';
    if (digestContent.totalOverdueReports > 0) {
        overdueReportsHTML = `
            <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #DC2626; font-weight: 600;">
                ⚠️ Gecikmiş Raporlar (${digestContent.totalOverdueReports})
            </h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #FEE2E2; border: 1px solid #DC2626; border-radius: 8px; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #FCA5A5;">
                        <th style="text-align: left; font-size: 12px; color: #7F1D1D; font-weight: 600; padding: 12px 8px;">Rapor Adı</th>
                        <th style="text-align: left; font-size: 12px; color: #7F1D1D; font-weight: 600; padding: 12px 8px;">Kampanya</th>
                        <th style="text-align: center; font-size: 12px; color: #7F1D1D; font-weight: 600; padding: 12px 8px;">Gecikme</th>
                        <th style="text-align: left; font-size: 12px; color: #7F1D1D; font-weight: 600; padding: 12px 8px;">Atanan</th>
                    </tr>
                </thead>
                <tbody>
                    ${digestContent.overdueReports.map(report => `
                        <tr style="border-top: 1px solid #DC2626;">
                            <td style="font-size: 13px; color: #991B1B; padding: 8px;"><strong>${report.title}</strong></td>
                            <td style="font-size: 13px; color: #991B1B; padding: 8px;">${report.campaignTitle || '-'}</td>
                            <td style="font-size: 13px; color: #991B1B; padding: 8px; text-align: center;"><strong>${report.daysOverdue} gün</strong></td>
                            <td style="font-size: 13px; color: #991B1B; padding: 8px;">${report.assigneeName}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        overdueReportsHTML = `
            <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #10B981; font-weight: 600;">
                ✅ Gecikmiş Raporlar
            </h3>
            <div style="background-color: #D1FAE5; border: 1px solid #10B981; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #065F46;">
                    🎉 Harika! Gecikmiş rapor bulunmuyor.
                </p>
            </div>
        `;
    }

    // Build this week's campaigns table
    let thisWeekCampaignsHTML = '';
    if (digestContent.totalThisWeekCampaigns > 0) {
        thisWeekCampaignsHTML = `
            <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #7C3AED; font-weight: 600;">
                📅 Bu Hafta Yapılacak Kampanyalar (${digestContent.totalThisWeekCampaigns})
            </h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #F3E8FF; border: 1px solid #7C3AED; border-radius: 8px; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #DDD6FE;">
                        <th style="text-align: left; font-size: 12px; color: #4C1D95; font-weight: 600; padding: 12px 8px;">Tarih</th>
                        <th style="text-align: left; font-size: 12px; color: #4C1D95; font-weight: 600; padding: 12px 8px;">Kampanya Adı</th>
                        <th style="text-align: center; font-size: 12px; color: #4C1D95; font-weight: 600; padding: 12px 8px;">Aciliyet</th>
                        <th style="text-align: left; font-size: 12px; color: #4C1D95; font-weight: 600; padding: 12px 8px;">Atanan</th>
                    </tr>
                </thead>
                <tbody>
                    ${digestContent.thisWeekCampaigns.map(campaign => {
                        const dateStr = campaign.date.toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            weekday: 'short'
                        });
                        return `
                            <tr style="border-top: 1px solid #A78BFA;">
                                <td style="font-size: 13px; color: #6B21A8; padding: 8px; white-space: nowrap;">${dateStr}</td>
                                <td style="font-size: 13px; color: #6B21A8; padding: 8px;"><strong>${campaign.title}</strong></td>
                                <td style="font-size: 13px; color: #6B21A8; padding: 8px; text-align: center;">${campaign.urgencyLabel}</td>
                                <td style="font-size: 13px; color: #6B21A8; padding: 8px;">${campaign.assigneeName}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } else {
        thisWeekCampaignsHTML = `
            <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #6B7280; font-weight: 600;">
                📅 Bu Hafta Yapılacak Kampanyalar
            </h3>
            <div style="background-color: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #4B5563;">
                    Bu hafta planlanmış kampanya bulunmuyor.
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
            <title>Haftalık Bülten</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F8F9FE;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FE; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="650" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <tr>
                                <td style="background-color: #F9FAFB; padding: 32px; text-align: center; border-bottom: 1px solid #E5E7EB;">
                                    <h1 style="margin: 0; color: #1F2937; font-size: 28px; font-weight: 700;">📊 Haftalık Bülten</h1>
                                    <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 16px; font-weight: 500;">${weekRangeStr}</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 32px;">
                                    <p style="margin: 0 0 24px 0; font-size: 16px; color: #1F2937;">İyi Günler <strong>${recipientName}</strong>,</p>
                                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">İşte bu haftanın özeti:</p>
                                    ${overdueReportsHTML}
                                    ${thisWeekCampaignsHTML}
                                    <div style="text-align: center; margin: 32px 0;">
                                        <a href="https://www.kampanyatakvimi.net.tr" style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #4338CA 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3);">Takvime Git →</a>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style="background-color: #F9FAFB; padding: 24px; text-align: center; border-top: 1px solid #E5E7EB;">
                                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">Bu otomatik bir haftalık bültendir.</p>
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

async function checkWeeklyDigestAlreadySent(db: Firestore, weekStr: string): Promise<boolean> {
    try {
        const logsRef = db.collection('reminderLogs');
        const snapshot = await logsRef
            .where('eventId', '==', `weekly-digest-${weekStr}`)
            .where('status', '==', 'success')
            .get();

        return snapshot.size >= 1;
    } catch (error) {
        console.error('Error checking existing weekly digest:', error);
        return false;
    }
}

async function logWeeklyDigest(db: Firestore, params: {
    recipientEmail: string;
    recipientName: string;
    status: 'success' | 'failed';
    digestContent: DigestContent;
    errorMessage?: string;
    messageId?: string;
}): Promise<void> {
    try {
        const weekRangeStr = `${params.digestContent.weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} - ${params.digestContent.weekEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

        const logEntry: Record<string, any> = {
            eventId: `weekly-digest-${params.digestContent.weekStart.toISOString().split('T')[0]}`,
            eventType: 'weekly-digest',
            eventTitle: `Haftalık Bülten - ${weekRangeStr}`,
            recipientEmail: params.recipientEmail,
            recipientName: params.recipientName,
            urgency: 'Medium',
            sentAt: Timestamp.now(),
            status: params.status,
            emailProvider: 'resend',
            digestStats: {
                overdueReportsCount: params.digestContent.totalOverdueReports,
                thisWeekCampaignsCount: params.digestContent.totalThisWeekCampaigns,
            },
        };
        if (params.errorMessage) logEntry.errorMessage = params.errorMessage;
        if (params.messageId) logEntry.messageId = params.messageId;
        await db.collection('reminderLogs').add(logEntry);
    } catch (error) {
        console.error('Error logging weekly digest:', error);
    }
}

// ===== MAIN PROCESSOR =====

async function processWeeklyDigest(
    db: Firestore,
    reports: Report[],
    campaigns: CalendarEvent[],
    users: User[],
    departmentUsers: DepartmentUser[],
    settings: ReminderSettings
): Promise<ProcessResult> {
    const result: ProcessResult = { sent: 0, failed: 0, skipped: 0 };
    const now = new Date();

    console.log('=== WEEKLY DIGEST PROCESS START ===');
    console.log('weeklyDigestEnabled:', settings.weeklyDigestEnabled);
    console.log('weeklyDigestDay:', settings.weeklyDigestDay);
    console.log('weeklyDigestTime:', settings.weeklyDigestTime);
    console.log('emailCcRecipients count:', settings.emailCcRecipients?.length || 0);

    if (!settings.weeklyDigestEnabled) {
        console.log('❌ REASON: Weekly digest is disabled');
        return result;
    }

    if (!settings.weeklyDigestDay && settings.weeklyDigestDay !== 0) {
        console.log('❌ REASON: No weekly digest day configured');
        return result;
    }

    if (!settings.weeklyDigestTime) {
        console.log('❌ REASON: No weekly digest time configured');
        return result;
    }

    // Convert server time (UTC) to Turkey time (UTC+3)
    const turkeyTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    const currentDay = turkeyTime.getDay(); // 0=Sunday, 1=Monday, etc.
    const currentHour = turkeyTime.getHours();
    const currentMinute = turkeyTime.getMinutes();

    console.log('Target day:', settings.weeklyDigestDay, '(0=Sun, 1=Mon, etc.)');
    console.log('Current day:', currentDay);

    // Check if it's the right day
    if (currentDay !== settings.weeklyDigestDay) {
        console.log('❌ REASON: Not the configured day yet');
        return result;
    }

    // Parse configured time
    const [targetHour, targetMinute] = settings.weeklyDigestTime.split(':').map(Number);

    console.log('Target time:', `${targetHour}:${targetMinute} Turkey`);
    console.log('Current time:', `${currentHour}:${currentMinute} Turkey`);

    // Check if it's time: ±5 dakika penceresi
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const targetTotalMinutes = targetHour * 60 + targetMinute;
    const diff = Math.abs(currentTotalMinutes - targetTotalMinutes);
    const isTime = diff <= 5;

    console.log('Is time to send?', isTime, `(diff: ${diff} min)`);
    if (!isTime) {
        console.log('❌ REASON: Not time yet for weekly digest');
        return result;
    }

    if (!settings.resendApiKey) {
        console.error('Resend API key is not configured');
        return result;
    }

    // Build digest content
    console.log('Building weekly digest content...');
    const digestContent = buildWeeklyDigest(reports, campaigns, users);

    // Check if already sent this week
    const weekStr = digestContent.weekStart.toISOString().split('T')[0];
    const alreadySent = await checkWeeklyDigestAlreadySent(db, weekStr);
    if (alreadySent) {
        console.log('Weekly digest already sent for this week');
        return result;
    }

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

    let emailsSentCount = 0;

    // Send email to each designer
    for (const designer of designerUsers) {
        try {
            const html = buildWeeklyDigestHTML({
                recipientName: designer.name || designer.username,
                digestContent
            });

            const weekRangeStr = `${digestContent.weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} - ${digestContent.weekEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

            const emailResult = await sendEmailInternal(
                settings.resendApiKey,
                {
                    to: designer.email!,
                    subject: `📊 Haftalık Bülten - ${weekRangeStr}`,
                    html
                }
            );

            if (emailResult.success) {
                console.log(`✅ Sent to ${designer.name || designer.username}`);
                result.sent++;
                emailsSentCount++;

                await logWeeklyDigest(db, {
                    recipientEmail: designer.email!,
                    recipientName: designer.name || designer.username,
                    status: 'success',
                    digestContent,
                    messageId: emailResult.messageId,
                });
            } else {
                console.error(`❌ Failed to send to ${designer.name}: ${emailResult.error}`);
                result.failed++;

                await logWeeklyDigest(db, {
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

            await logWeeklyDigest(db, {
                recipientEmail: designer.email!,
                recipientName: designer.name || designer.username,
                status: 'failed',
                digestContent,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
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
        console.log('Starting Weekly Digest Cron Job...');

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

        if (!settings.weeklyDigestEnabled) {
            console.log('Weekly digest is disabled');
            return res.status(200).json({ status: 'skipped', reason: 'disabled' });
        }

        // Fetch Data
        console.log('Fetching data...');

        const reportsSnapshot = await db.collection('reports').get();
        const reports = reportsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                dueDate: data.dueDate?.toDate() || new Date(),
            };
        }) as Report[];

        const campaignsSnapshot = await db.collection('events').get();
        const campaigns = campaignsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date?.toDate() || new Date(),
                createdAt: data.createdAt?.toDate() || new Date(),
            };
        }) as CalendarEvent[];

        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as User[];

        const deptUsersSnapshot = await db.collection('departmentUsers').get();
        const deptUsers = deptUsersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as DepartmentUser[];

        // Process
        console.log('Processing weekly digest...');
        const result = await processWeeklyDigest(db, reports, campaigns, users, deptUsers, settings);

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
