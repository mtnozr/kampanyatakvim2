/**
 * Vercel Cron Job for Personal Daily Bulletin
 * Sends each user their daily tasks from Campaign, Report, and Analytics tabs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

// ===== TYPE DEFINITIONS =====

interface ReminderSettings {
    resendApiKey?: string;
    personalDailyBulletinEnabled?: boolean;
    personalDailyBulletinTime?: string;
    personalDailyBulletinRecipients?: string[];
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

interface AnalyticsTask {
    id: string;
    title: string;
    date: Date;
    status: string;
    urgency: string;
    assigneeId?: string;
    notes?: string;
}

interface Report {
    id: string;
    title: string;
    dueDate: Date;
    status: string;
    assigneeId?: string;
    campaignTitle?: string;
}

interface DepartmentUser {
    id: string;
    username: string;
    name?: string;
    email?: string;
}

interface User {
    id: string;
    name: string;
    email: string;
}

interface PersonalBulletinContent {
    campaigns: CalendarEvent[];
    reports: Report[];
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

// ===== PERSONAL BULLETIN BUILDER =====

function buildPersonalBulletin(
    campaigns: CalendarEvent[],
    reports: Report[],
    analyticsTasks: AnalyticsTask[],
    recipientEmail: string,
    idToEmail: Map<string, string>,
    targetDate: Date = new Date()
): PersonalBulletinContent {
    const email = recipientEmail.toLowerCase().trim();

    // Simple: campaign's assigneeId → resolve to email → match with recipient email
    const userCampaigns = campaigns.filter(c => {
        if (!c.assigneeId) return false;
        const assigneeEmail = idToEmail.get(c.assigneeId);
        return assigneeEmail === email &&
            isSameDay(c.date, targetDate) &&
            c.status !== 'İptal Edildi' &&
            c.status !== 'Tamamlandı';
    });

    const userReports = reports.filter(r => {
        if (!r.assigneeId) return false;
        const assigneeEmail = idToEmail.get(r.assigneeId);
        return assigneeEmail === email &&
            isSameDay(r.dueDate, targetDate) &&
            r.status !== 'done';
    });

    const userTasks = analyticsTasks.filter(t => {
        if (!t.assigneeId) return false;
        const assigneeEmail = idToEmail.get(t.assigneeId);
        return assigneeEmail === email &&
            isSameDay(t.date, targetDate) &&
            t.status !== 'İptal Edildi';
    });

    console.log(`  buildPersonalBulletin: email=${email}, campaigns=${userCampaigns.length}, reports=${userReports.length}, analytics=${userTasks.length}`);

    return {
        campaigns: userCampaigns,
        reports: userReports,
        analyticsTasks: userTasks,
        date: targetDate
    };
}

// ===== EMAIL HTML BUILDER =====

function buildPersonalBulletinHTML(params: {
    recipientName: string;
    bulletinContent: PersonalBulletinContent;
}): string {
    const { recipientName, bulletinContent } = params;
    const date = bulletinContent.date;

    const dateStr = date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long'
    });

    const totalTasks = bulletinContent.campaigns.length +
                       bulletinContent.reports.length +
                       bulletinContent.analyticsTasks.length;

    // Build campaigns section
    let campaignsHTML = '';
    if (bulletinContent.campaigns.length > 0) {
        campaignsHTML = `
            <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #8B5CF6; font-weight: 600;">
                🎯 Kampanyalar (${bulletinContent.campaigns.length})
            </h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #F5F3FF; border: 1px solid #8B5CF6; border-radius: 8px; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #EDE9FE;">
                        <th style="text-align: left; font-size: 12px; color: #5B21B6; font-weight: 600; padding: 12px 8px;">Kampanya</th>
                        <th style="text-align: center; font-size: 12px; color: #5B21B6; font-weight: 600; padding: 12px 8px;">Aciliyet</th>
                        <th style="text-align: center; font-size: 12px; color: #5B21B6; font-weight: 600; padding: 12px 8px;">Durum</th>
                    </tr>
                </thead>
                <tbody>
                    ${bulletinContent.campaigns.map(campaign => `
                        <tr style="border-top: 1px solid #C4B5FD;">
                            <td style="font-size: 13px; color: #6B21A8; padding: 8px;"><strong>${campaign.title}</strong></td>
                            <td style="font-size: 13px; color: #6B21A8; padding: 8px; text-align: center;">${getUrgencyLabel(campaign.urgency)}</td>
                            <td style="font-size: 13px; color: #6B21A8; padding: 8px; text-align: center;">${campaign.status}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Build reports section
    let reportsHTML = '';
    if (bulletinContent.reports.length > 0) {
        reportsHTML = `
            <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #EF4444; font-weight: 600;">
                📊 Raporlar (${bulletinContent.reports.length})
            </h3>
            <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #FEF2F2; border: 1px solid: #EF4444; border-radius: 8px; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #FEE2E2;">
                        <th style="text-align: left; font-size: 12px; color: #991B1B; font-weight: 600; padding: 12px 8px;">Rapor</th>
                        <th style="text-align: left; font-size: 12px; color: #991B1B; font-weight: 600; padding: 12px 8px;">Kampanya</th>
                        <th style="text-align: center; font-size: 12px; color: #991B1B; font-weight: 600; padding: 12px 8px;">Durum</th>
                    </tr>
                </thead>
                <tbody>
                    ${bulletinContent.reports.map(report => `
                        <tr style="border-top: 1px solid: #FECACA;">
                            <td style="font-size: 13px; color: #991B1B; padding: 8px;"><strong>${report.title}</strong></td>
                            <td style="font-size: 13px; color: #991B1B; padding: 8px;">${report.campaignTitle || '-'}</td>
                            <td style="font-size: 13px; color: #991B1B; padding: 8px; text-align: center;">${report.status === 'pending' ? 'Bekliyor' : 'Tamamlandı'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

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

    // If no tasks at all
    if (totalTasks === 0) {
        return `
            <!DOCTYPE html>
            <html lang="tr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Günlük Bülten</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F8F9FE;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FE; padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table width="650" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                <tr>
                                    <td style="background-color: #F9FAFB; padding: 32px; text-align: center; border-bottom: 1px solid #E5E7EB;">
                                        <h1 style="margin: 0; color: #1F2937; font-size: 28px; font-weight: 700;">☀️ Günlük Bülten</h1>
                                        <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 16px; font-weight: 500;">${dateStr}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 32px;">
                                        <p style="margin: 0 0 24px 0; font-size: 16px; color: #1F2937;">Günaydın <strong>${recipientName}</strong>,</p>
                                        <div style="background-color: #F0FDF4; border: 1px solid #86EFAC; border-radius: 8px; padding: 24px; text-align: center;">
                                            <p style="margin: 0; font-size: 18px; color: #166534; font-weight: 600;">
                                                🎉 Bugün için göreviniz yok!
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
            <title>Günlük Bülten</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F8F9FE;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FE; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="650" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <tr>
                                <td style="background-color: #F9FAFB; padding: 32px; text-align: center; border-bottom: 1px solid #E5E7EB;">
                                    <h1 style="margin: 0; color: #1F2937; font-size: 28px; font-weight: 700;">☀️ Günlük Bülten</h1>
                                    <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 16px; font-weight: 500;">${dateStr}</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 32px;">
                                    <p style="margin: 0 0 24px 0; font-size: 16px; color: #1F2937;">Günaydın <strong>${recipientName}</strong>,</p>
                                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">Bugün yapmanız gereken <strong>${totalTasks} iş</strong> bulunmaktadır:</p>
                                    ${campaignsHTML}
                                    ${reportsHTML}
                                    ${analyticsHTML}
                                    <div style="text-align: center; margin: 32px 0;">
                                        <a href="https://www.kampanyatakvimi.net.tr" style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.3);">Takvime Git →</a>
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
    cc?: string[];
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const emailBody: any = {
            from: 'Kampanya Takvimi <hatirlatma@kampanyatakvimi.net.tr>',
            to: params.to,
            subject: params.subject,
            html: params.html,
        };

        // Add CC if provided
        if (params.cc && params.cc.length > 0) {
            emailBody.cc = params.cc;
        }

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailBody),
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
            .where('eventId', '==', `personal-bulletin-${dateStr}-${userId}`)
            .where('status', '==', 'success')
            .limit(1)
            .get();

        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking existing bulletin:', error);
        return false;
    }
}

async function logPersonalBulletin(db: Firestore, params: {
    recipientEmail: string;
    recipientName: string;
    userId: string;
    status: 'success' | 'failed';
    bulletinContent: PersonalBulletinContent;
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
            eventId: `personal-bulletin-${params.bulletinContent.date.toISOString().split('T')[0]}-${params.userId}`,
            eventType: 'personal-bulletin',
            eventTitle: `Günlük Bülten - ${dateStr}`,
            recipientEmail: params.recipientEmail,
            recipientName: params.recipientName,
            urgency: 'Medium',
            sentAt: Timestamp.now(),
            status: params.status,
            errorMessage: params.errorMessage,
            emailProvider: 'resend',
            messageId: params.messageId,
            bulletinStats: {
                campaignsCount: params.bulletinContent.campaigns.length,
                reportsCount: params.bulletinContent.reports.length,
                analyticsCount: params.bulletinContent.analyticsTasks.length,
            },
        });
    } catch (error) {
        console.error('Error logging personal bulletin:', error);
    }
}

// ===== MAIN PROCESSOR =====

async function processPersonalBulletins(
    db: Firestore,
    campaigns: CalendarEvent[],
    reports: Report[],
    analyticsTasks: AnalyticsTask[],
    departmentUsers: DepartmentUser[],
    users: User[],
    settings: ReminderSettings
): Promise<ProcessResult> {
    const result: ProcessResult = { sent: 0, failed: 0, skipped: 0 };
    const now = new Date();

    console.log('=== PERSONAL BULLETIN PROCESS START ===');
    console.log('personalDailyBulletinEnabled:', settings.personalDailyBulletinEnabled);
    console.log('personalDailyBulletinTime:', settings.personalDailyBulletinTime);
    console.log('recipientIds count:', settings.personalDailyBulletinRecipients?.length || 0);

    if (!settings.personalDailyBulletinEnabled) {
        console.log('❌ REASON: Personal daily bulletin is disabled');
        return result;
    }

    if (!settings.personalDailyBulletinTime) {
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
    const [targetHour, targetMinute] = settings.personalDailyBulletinTime.split(':').map(Number);

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

    // Get recipients (filter from all departmentUsers)
    const recipientIds = settings.personalDailyBulletinRecipients || [];
    const recipients = departmentUsers.filter(user =>
        recipientIds.includes(user.id) && user.email
    );

    if (recipients.length === 0) {
        console.log('❌ No recipients with email found. recipientIds:', JSON.stringify(recipientIds));
        console.log('  departmentUsers count:', departmentUsers.length);
        console.log('  departmentUser IDs:', departmentUsers.map(u => u.id).join(', '));
        return result;
    }

    console.log(`Processing bulletins for ${recipients.length} users`);

    // ===== EMAIL-BASED MATCHING =====
    // Simple approach: build ID→email map, match campaigns to recipients by email
    const idToEmail = new Map<string, string>();

    // Map all user IDs to their emails (from users collection)
    for (const u of users) {
        if (u.email) idToEmail.set(u.id, u.email.toLowerCase().trim());
    }
    // Map all departmentUser IDs to their emails
    for (const du of departmentUsers) {
        if (du.email) idToEmail.set(du.id, du.email.toLowerCase().trim());
    }

    console.log(`Built ID→email map with ${idToEmail.size} entries`);

    // Debug: show which campaign assignees we can resolve
    for (const c of campaigns) {
        const resolvedEmail = c.assigneeId ? idToEmail.get(c.assigneeId) : 'no-assignee';
        console.log(`  Campaign "${c.title}" | assigneeId=${c.assigneeId} → email=${resolvedEmail || 'UNRESOLVED'} | status=${c.status}`);
    }

    // Get CC recipient emails from settings
    const ccRecipientEmails: string[] = [];
    if (settings.emailCcRecipients && settings.emailCcRecipients.length > 0) {
        for (const ccRecipientId of settings.emailCcRecipients) {
            const ccUser = departmentUsers.find(u => u.id === ccRecipientId);
            if (ccUser && ccUser.email) {
                ccRecipientEmails.push(ccUser.email);
            }
        }
        console.log(`Found ${ccRecipientEmails.length} CC recipients`);
    }

    // ⚠️ TEMPORARY TEST LIMIT: Maximum 3 emails per run
    const MAX_EMAILS_PER_RUN = 3;
    let emailsSentCount = 0;

    // Send bulletin to each recipient
    for (const user of recipients) {
        if (emailsSentCount >= MAX_EMAILS_PER_RUN) {
            console.log(`⚠️ TEST LIMIT REACHED: Stopped after sending ${MAX_EMAILS_PER_RUN} emails`);
            result.skipped += (recipients.length - emailsSentCount);
            break;
        }

        if (!user.email) {
            console.log(`⚠️ Skipping ${user.username}: no email`);
            result.skipped++;
            continue;
        }

        try {
            console.log(`\nProcessing: ${user.name || user.username} (${user.email})`);

            // Build bulletin - matches by EMAIL, not by ID
            const bulletinContent = buildPersonalBulletin(
                campaigns,
                reports,
                analyticsTasks,
                user.email,
                idToEmail,
                now
            );

            const totalTasks = bulletinContent.campaigns.length +
                             bulletinContent.reports.length +
                             bulletinContent.analyticsTasks.length;

            if (totalTasks === 0) {
                console.log(`⚠️ No tasks for ${user.name || user.username} (${user.email}), skipping`);
                result.skipped++;
                continue;
            }

            const html = buildPersonalBulletinHTML({
                recipientName: user.name || user.username,
                bulletinContent
            });

            const emailResult = await sendEmailInternal(
                settings.resendApiKey,
                {
                    to: user.email!,
                    subject: `Günlük Bülten - ${now.toLocaleDateString('tr-TR')} (${totalTasks} İş)`,
                    html,
                    cc: ccRecipientEmails.length > 0 ? ccRecipientEmails : undefined
                }
            );

            if (emailResult.success) {
                console.log(`✅ Sent to ${user.name || user.username}`);
                result.sent++;
                emailsSentCount++;

                await logPersonalBulletin(db, {
                    recipientEmail: user.email!,
                    recipientName: user.name || user.username,
                    userId: user.id,
                    status: 'success',
                    bulletinContent,
                    messageId: emailResult.messageId,
                });
            } else {
                console.error(`❌ Failed to send to ${user.name}: ${emailResult.error}`);
                result.failed++;

                await logPersonalBulletin(db, {
                    recipientEmail: user.email!,
                    recipientName: user.name || user.username,
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
        console.log('Starting Personal Daily Bulletin Cron Job...');

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

        if (!settings.personalDailyBulletinEnabled) {
            console.log('Personal daily bulletin is disabled');
            return res.status(200).json({ status: 'skipped', reason: 'disabled' });
        }

        // Fetch Data (optimized with today's date filter)
        console.log('Fetching data...');

        const now = new Date();
        const turkeyTime = new Date(now.getTime() + TURKEY_OFFSET_MS);

        // Calculate Turkey's start/end of day in UTC for Firestore query
        // Turkey midnight = UTC 21:00 (previous day)
        const turkeyYear = turkeyTime.getUTCFullYear();
        const turkeyMonth = turkeyTime.getUTCMonth();
        const turkeyDate = turkeyTime.getUTCDate();

        const startOfDay = new Date(Date.UTC(turkeyYear, turkeyMonth, turkeyDate, 0, 0, 0) - TURKEY_OFFSET_MS);
        const endOfDay = new Date(Date.UTC(turkeyYear, turkeyMonth, turkeyDate, 23, 59, 59, 999) - TURKEY_OFFSET_MS);

        console.log('Turkey date:', `${turkeyYear}-${turkeyMonth + 1}-${turkeyDate}`);
        console.log('Query range (UTC):', startOfDay.toISOString(), '->', endOfDay.toISOString());

        // Fetch today's campaigns
        const campaignsSnapshot = await db.collection('events')
            .where('date', '>=', Timestamp.fromDate(startOfDay))
            .where('date', '<=', Timestamp.fromDate(endOfDay))
            .get();

        const campaigns = campaignsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date?.toDate() || new Date(),
                createdAt: data.createdAt?.toDate() || new Date(),
            };
        }) as CalendarEvent[];

        // Fetch today's reports
        const reportsSnapshot = await db.collection('reports')
            .where('dueDate', '>=', Timestamp.fromDate(startOfDay))
            .where('dueDate', '<=', Timestamp.fromDate(endOfDay))
            .get();

        const reports = reportsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                dueDate: data.dueDate?.toDate() || new Date(),
            };
        }) as Report[];

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

        // Fetch ALL department users (needed for email mapping)
        const deptUsersSnapshot = await db.collection('departmentUsers').get();
        const allDeptUsers = deptUsersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as DepartmentUser[];

        // Filter to only recipients
        const recipientIds = settings.personalDailyBulletinRecipients || [];
        const deptUsers = allDeptUsers.filter(u => recipientIds.includes(u.id));

        // Fetch ALL users collection (for ID→email mapping)
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as User[];

        console.log(`Found: ${campaigns.length} campaigns, ${reports.length} reports, ${analyticsTasks.length} analytics, ${users.length} users, ${allDeptUsers.length} deptUsers, ${deptUsers.length} recipients`);
        console.log('recipientIds from settings:', JSON.stringify(recipientIds));

        // Process (pass ALL deptUsers for email mapping, recipients are filtered inside)
        const result = await processPersonalBulletins(
            db,
            campaigns,
            reports,
            analyticsTasks,
            allDeptUsers,
            users,
            settings
        );

        // Include diagnostic info in response for debugging
        const diagnostics = {
            queryRange: { start: startOfDay.toISOString(), end: endOfDay.toISOString() },
            turkeyDate: `${turkeyYear}-${String(turkeyMonth + 1).padStart(2, '0')}-${String(turkeyDate).padStart(2, '0')}`,
            campaignsFound: campaigns.map(c => ({ title: c.title, assigneeId: c.assigneeId, date: c.date.toISOString(), status: c.status })),
            recipientIds,
            recipientsResolved: deptUsers.map(u => ({ id: u.id, name: u.name, email: u.email })),
        };

        return res.status(200).json({
            success: true,
            result,
            diagnostics
        });

    } catch (error) {
        console.error('Cron job error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
