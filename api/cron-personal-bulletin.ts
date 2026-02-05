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
    userIds: string[],
    targetDate: Date = new Date()
): PersonalBulletinContent {
    // Filter for today and assigned to this user (try all possible user IDs)
    // Active campaigns: not cancelled or completed
    const userCampaigns = campaigns.filter(c =>
        isSameDay(c.date, targetDate) &&
        userIds.includes(c.assigneeId || '') &&
        c.status !== 'İptal Edildi' &&
        c.status !== 'Tamamlandı'
    );

    const userReports = reports.filter(r =>
        isSameDay(r.dueDate, targetDate) &&
        userIds.includes(r.assigneeId || '') &&
        r.status !== 'done'
    );

    const userTasks = analyticsTasks.filter(t =>
        isSameDay(t.date, targetDate) &&
        userIds.includes(t.assigneeId || '') &&
        t.status !== 'İptal Edildi'
    );

    console.log(`  buildPersonalBulletin: userIds=${userIds.join(',')}, campaigns=${userCampaigns.length}, reports=${userReports.length}, analytics=${userTasks.length}`);

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

    // Get recipients
    const recipientIds = settings.personalDailyBulletinRecipients || [];
    const recipients = departmentUsers.filter(user =>
        recipientIds.includes(user.id) && user.email
    );

    if (recipients.length === 0) {
        console.log('No recipients configured');
        return result;
    }

    console.log(`Processing bulletins for ${recipients.length} users`);

    // Get CC recipient emails from settings
    const ccRecipientEmails: string[] = [];
    if (settings.emailCcRecipients && settings.emailCcRecipients.length > 0) {
        for (const ccRecipientId of settings.emailCcRecipients) {
            const ccUser = departmentUsers.find(u => u.id === ccRecipientId);
            if (ccUser && ccUser.email) {
                ccRecipientEmails.push(ccUser.email);
            }
        }
        console.log(`Found ${ccRecipientEmails.length} CC recipients for personal bulletins`);
    }

    // ⚠️ TEMPORARY TEST LIMIT: Maximum 3 emails per run
    const MAX_EMAILS_PER_RUN = 3;
    let emailsSentCount = 0;

    // Send bulletin to each user
    for (const user of recipients) {
        // Check if we've reached the test limit
        if (emailsSentCount >= MAX_EMAILS_PER_RUN) {
            console.log(`⚠️ TEST LIMIT REACHED: Stopped after sending ${MAX_EMAILS_PER_RUN} emails`);
            result.skipped += (recipients.length - emailsSentCount);
            break;
        }

        try {
            const todayStr = now.toISOString().split('T')[0];

            // ⚠️ TEMP: Disabled for testing - allow multiple sends per day
            // Check if already sent today
            // const alreadySent = await checkBulletinAlreadySent(db, todayStr, user.id);
            // if (alreadySent) {
            //     console.log(`Bulletin already sent to ${user.name || user.username} today`);
            //     result.skipped++;
            //     continue;
            // }

            // Build list of all possible user IDs for this person
            // Campaigns might use users.id OR departmentUsers.id for assigneeId
            const possibleUserIds: string[] = [user.id]; // departmentUsers.id

            // Also try matching to 'users' collection by email or name
            let matchingUser = users.find(u => u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase());
            if (!matchingUser) {
                const userName = user.name || user.username;
                matchingUser = users.find(u => u.name && userName && u.name.toLowerCase() === userName.toLowerCase());
            }
            if (matchingUser && !possibleUserIds.includes(matchingUser.id)) {
                possibleUserIds.push(matchingUser.id);
            }

            console.log(`User ${user.username}: email=${user.email}, deptUserId=${user.id}, matchedUserId=${matchingUser?.id || 'NO_MATCH'}, matchedBy=${matchingUser ? (matchingUser.email?.toLowerCase() === user.email?.toLowerCase() ? 'email' : 'name') : 'none'}, possibleIds=[${possibleUserIds.join(',')}]`);

            // Build bulletin content for this user (tries all possible IDs)
            const bulletinContent = buildPersonalBulletin(
                campaigns,
                reports,
                analyticsTasks,
                possibleUserIds,
                now
            );

            // Skip if user has no tasks today
            const totalTasks = bulletinContent.campaigns.length +
                             bulletinContent.reports.length +
                             bulletinContent.analyticsTasks.length;

            if (totalTasks === 0) {
                console.log(`⚠️ No tasks for ${user.name || user.username} today (possibleIds=[${possibleUserIds.join(',')}]), skipping email`);
                // Debug: show all campaign assigneeIds to help troubleshoot
                if (campaigns.length > 0) {
                    const allAssigneeIds = [...new Set(campaigns.map(c => c.assigneeId).filter(Boolean))];
                    console.log(`  Available campaign assigneeIds: [${allAssigneeIds.join(',')}]`);
                    console.log(`  None of possibleIds [${possibleUserIds.join(',')}] matched any assigneeId`);
                }
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

        // Fetch department users (only recipients)
        const recipientIds = settings.personalDailyBulletinRecipients || [];
        let deptUsers: DepartmentUser[] = [];

        if (recipientIds.length > 0) {
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
        }

        // Fetch users collection (campaigns use users.id for assigneeId)
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as User[];

        console.log(`Found ${campaigns.length} campaigns, ${reports.length} reports, ${analyticsTasks.length} analytics tasks, ${users.length} users, ${deptUsers.length} deptUsers`);

        // Debug: Log all found campaigns
        console.log('=== CAMPAIGNS FOUND FOR TODAY ===');
        campaigns.forEach(c => {
            console.log(`  Campaign: "${c.title}" | date: ${c.date.toISOString()} | assigneeId: ${c.assigneeId} | status: ${c.status}`);
        });

        // Debug: Log all found reports
        console.log('=== REPORTS FOUND FOR TODAY ===');
        reports.forEach(r => {
            console.log(`  Report: "${r.title}" | dueDate: ${r.dueDate.toISOString()} | assigneeId: ${r.assigneeId} | status: ${r.status}`);
        });

        // Debug: Log all found analytics tasks
        console.log('=== ANALYTICS TASKS FOUND FOR TODAY ===');
        analyticsTasks.forEach(t => {
            console.log(`  Task: "${t.title}" | date: ${t.date.toISOString()} | assigneeId: ${t.assigneeId} | status: ${t.status}`);
        });

        // Debug: Log department users
        console.log('=== DEPARTMENT USERS (RECIPIENTS) ===');
        deptUsers.forEach(u => {
            console.log(`  DeptUser: id=${u.id} | name=${u.name} | username=${u.username} | email=${u.email}`);
        });

        // Debug: Log users collection
        console.log('=== USERS COLLECTION ===');
        users.forEach(u => {
            console.log(`  User: id=${u.id} | name=${u.name} | email=${u.email}`);
        });

        // Process
        const result = await processPersonalBulletins(
            db,
            campaigns,
            reports,
            analyticsTasks,
            deptUsers,
            users,
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
