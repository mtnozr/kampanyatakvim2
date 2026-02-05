/**
 * Vercel Cron Job for Personal Daily Bulletin
 * SIMPLIFIED: Sends bulletins to people who have campaigns TODAY
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
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
}

interface User {
    id: string;
    name: string;
    email: string;
}

interface DepartmentUser {
    id: string;
    username: string;
    name?: string;
    email?: string;
}

// ===== FIREBASE ADMIN INITIALIZATION =====

function initFirebaseAdmin() {
    if (!admin.apps.length) {
        const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!serviceAccountStr) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT missing');
        }

        let serviceAccount = JSON.parse(serviceAccountStr);
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    return admin;
}

// ===== TURKEY TIMEZONE =====
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000;

function getTurkeyDateRange(): { start: Date; end: Date; turkeyDateStr: string } {
    const now = new Date();
    const turkeyTime = new Date(now.getTime() + TURKEY_OFFSET_MS);
    const y = turkeyTime.getUTCFullYear();
    const m = turkeyTime.getUTCMonth();
    const d = turkeyTime.getUTCDate();

    // Turkey midnight to midnight in UTC
    const start = new Date(Date.UTC(y, m, d, 0, 0, 0) - TURKEY_OFFSET_MS);
    const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - TURKEY_OFFSET_MS);

    return {
        start,
        end,
        turkeyDateStr: `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    };
}

function isTimeToSend(targetTime: string): boolean {
    const now = new Date();
    const turkeyTime = new Date(now.getTime() + TURKEY_OFFSET_MS);
    const currentHour = turkeyTime.getUTCHours();
    const currentMinute = turkeyTime.getUTCMinutes();

    const [targetHour, targetMinute] = targetTime.split(':').map(Number);

    return currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);
}

function isWeekend(): boolean {
    const now = new Date();
    const turkeyTime = new Date(now.getTime() + TURKEY_OFFSET_MS);
    const day = turkeyTime.getUTCDay();
    return day === 0 || day === 6;
}

// ===== EMAIL SENDING =====

async function sendEmail(apiKey: string, to: string, subject: string, html: string): Promise<{success: boolean; error?: string}> {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Kampanya Takvimi <hatirlatma@kampanyatakvimi.net.tr>',
                to,
                subject,
                html,
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            return { success: false, error: err.message || 'Failed' };
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Unknown' };
    }
}

function buildEmailHTML(recipientName: string, campaigns: CalendarEvent[], dateStr: string): string {
    const campaignRows = campaigns.map(c => `
        <tr style="border-top: 1px solid #C4B5FD;">
            <td style="padding: 12px; font-size: 14px; color: #6B21A8;"><strong>${c.title}</strong></td>
            <td style="padding: 12px; font-size: 14px; color: #6B21A8; text-align: center;">${c.urgency}</td>
            <td style="padding: 12px; font-size: 14px; color: #6B21A8; text-align: center;">${c.status || 'Planlandı'}</td>
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background: #F8F9FE; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="background: #8B5CF6; color: white; padding: 24px; text-align: center;">
                <h1 style="margin: 0;">☀️ Günlük Bülten</h1>
                <p style="margin: 8px 0 0;">${dateStr}</p>
            </div>
            <div style="padding: 24px;">
                <p>Günaydın <strong>${recipientName}</strong>,</p>
                <p>Bugün <strong>${campaigns.length} kampanyanız</strong> var:</p>
                <table style="width: 100%; border-collapse: collapse; background: #F5F3FF; border-radius: 8px; margin: 16px 0;">
                    <thead>
                        <tr style="background: #EDE9FE;">
                            <th style="padding: 12px; text-align: left; color: #5B21B6;">Kampanya</th>
                            <th style="padding: 12px; text-align: center; color: #5B21B6;">Aciliyet</th>
                            <th style="padding: 12px; text-align: center; color: #5B21B6;">Durum</th>
                        </tr>
                    </thead>
                    <tbody>${campaignRows}</tbody>
                </table>
                <div style="text-align: center; margin-top: 24px;">
                    <a href="https://www.kampanyatakvimi.net.tr" style="display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Takvime Git →</a>
                </div>
            </div>
            <div style="background: #F9FAFB; padding: 16px; text-align: center; color: #6B7280; font-size: 12px;">
                Bu otomatik bir bültendir.
            </div>
        </div>
    </body>
    </html>
    `;
}

// ===== MAIN HANDLER =====

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };

    try {
        // Auth check
        const queryKey = Array.isArray(req.query.key) ? req.query.key[0] : req.query.key;
        const expectedKey = process.env.CRON_SECRET_KEY;
        if (queryKey !== expectedKey && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        log('=== PERSONAL BULLETIN START ===');

        // Init Firebase
        const adminSDK = initFirebaseAdmin();
        const db = adminSDK.firestore();

        // Load settings
        const settingsDoc = await db.collection('reminderSettings').doc('default').get();
        if (!settingsDoc.exists) {
            log('❌ No settings found');
            return res.status(200).json({ success: false, reason: 'no_settings', logs });
        }

        const settings = settingsDoc.data() as ReminderSettings;
        log(`Settings: enabled=${settings.personalDailyBulletinEnabled}, time=${settings.personalDailyBulletinTime}`);

        if (!settings.personalDailyBulletinEnabled) {
            log('❌ Bulletin disabled');
            return res.status(200).json({ success: false, reason: 'disabled', logs });
        }

        if (!settings.personalDailyBulletinTime) {
            log('❌ No time set');
            return res.status(200).json({ success: false, reason: 'no_time', logs });
        }

        if (!settings.resendApiKey) {
            log('❌ No API key');
            return res.status(200).json({ success: false, reason: 'no_api_key', logs });
        }

        // Weekend check
        if (isWeekend()) {
            log('❌ Weekend - skipping');
            return res.status(200).json({ success: false, reason: 'weekend', logs });
        }

        // Time check
        if (!isTimeToSend(settings.personalDailyBulletinTime)) {
            log(`❌ Not time yet (target: ${settings.personalDailyBulletinTime})`);
            return res.status(200).json({ success: false, reason: 'not_time', logs });
        }

        log('✅ All checks passed, fetching data...');

        // Get today's date range
        const { start, end, turkeyDateStr } = getTurkeyDateRange();
        log(`Turkey date: ${turkeyDateStr}`);
        log(`Query range: ${start.toISOString()} to ${end.toISOString()}`);

        // Fetch today's campaigns
        const campaignsSnapshot = await db.collection('events')
            .where('date', '>=', Timestamp.fromDate(start))
            .where('date', '<=', Timestamp.fromDate(end))
            .get();

        const allCampaigns: CalendarEvent[] = campaignsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                date: data.date?.toDate() || new Date(),
                status: data.status,
                urgency: data.urgency,
                assigneeId: data.assigneeId,
            };
        });

        log(`Found ${allCampaigns.length} campaigns today`);
        allCampaigns.forEach(c => {
            log(`  - "${c.title}" assigneeId=${c.assigneeId} status=${c.status}`);
        });

        // Filter active campaigns (not cancelled/completed)
        const activeCampaigns = allCampaigns.filter(c =>
            c.status !== 'İptal Edildi' && c.status !== 'Tamamlandı'
        );
        log(`Active campaigns: ${activeCampaigns.length}`);

        if (activeCampaigns.length === 0) {
            log('❌ No active campaigns today');
            return res.status(200).json({ success: true, reason: 'no_campaigns', sent: 0, logs });
        }

        // Get unique assignee IDs
        const assigneeIds = [...new Set(activeCampaigns.map(c => c.assigneeId).filter(Boolean))] as string[];
        log(`Unique assignees: ${assigneeIds.length}`);

        // Fetch users to get emails
        const usersSnapshot = await db.collection('users').get();
        const users: User[] = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            email: doc.data().email,
        }));
        log(`Users in DB: ${users.length}`);

        // Build map: assigneeId -> user info
        const userMap = new Map<string, User>();
        users.forEach(u => userMap.set(u.id, u));

        // Check which recipients are selected in settings
        const selectedRecipientIds = settings.personalDailyBulletinRecipients || [];
        log(`Selected recipients in settings: ${selectedRecipientIds.length}`);
        log(`Selected IDs: ${JSON.stringify(selectedRecipientIds)}`);

        // Also fetch departmentUsers to check their emails
        const deptUsersSnapshot = await db.collection('departmentUsers').get();
        const deptUsers: DepartmentUser[] = deptUsersSnapshot.docs.map(doc => ({
            id: doc.id,
            username: doc.data().username,
            name: doc.data().name,
            email: doc.data().email,
        }));
        log(`DepartmentUsers in DB: ${deptUsers.length}`);

        // Build email -> user mapping (from both collections)
        const emailToName = new Map<string, string>();
        users.forEach(u => {
            if (u.email) emailToName.set(u.email.toLowerCase(), u.name);
        });
        deptUsers.forEach(u => {
            if (u.email) emailToName.set(u.email.toLowerCase(), u.name || u.username);
        });

        // Build assigneeId -> email mapping
        const assigneeIdToEmail = new Map<string, string>();
        users.forEach(u => {
            if (u.email) assigneeIdToEmail.set(u.id, u.email.toLowerCase());
        });

        log('=== ASSIGNEE → EMAIL MAPPING ===');
        assigneeIds.forEach(id => {
            const email = assigneeIdToEmail.get(id);
            log(`  ${id} → ${email || 'NO EMAIL FOUND'}`);
        });

        // Now check: which assignees are in the selected recipients list?
        // Recipients are departmentUser IDs, not user IDs
        // So we need to match by EMAIL

        // Build deptUserId -> email mapping
        const deptUserIdToEmail = new Map<string, string>();
        deptUsers.forEach(du => {
            if (du.email) deptUserIdToEmail.set(du.id, du.email.toLowerCase());
        });

        // Get selected recipient emails
        const selectedEmails = new Set<string>();
        selectedRecipientIds.forEach(id => {
            const email = deptUserIdToEmail.get(id);
            if (email) selectedEmails.add(email);
        });
        log(`Selected recipient emails: ${[...selectedEmails].join(', ')}`);

        // Now filter: only send to assignees whose email is in selectedEmails
        const emailsToSend = new Map<string, CalendarEvent[]>(); // email -> campaigns

        activeCampaigns.forEach(campaign => {
            if (!campaign.assigneeId) return;

            const assigneeEmail = assigneeIdToEmail.get(campaign.assigneeId);
            if (!assigneeEmail) {
                log(`⚠️ Campaign "${campaign.title}": assigneeId ${campaign.assigneeId} has no email`);
                return;
            }

            if (!selectedEmails.has(assigneeEmail)) {
                log(`⚠️ Campaign "${campaign.title}": assignee email ${assigneeEmail} not in selected recipients`);
                return;
            }

            if (!emailsToSend.has(assigneeEmail)) {
                emailsToSend.set(assigneeEmail, []);
            }
            emailsToSend.get(assigneeEmail)!.push(campaign);
        });

        log(`Emails to send: ${emailsToSend.size}`);

        if (emailsToSend.size === 0) {
            log('❌ No matching recipients for today\'s campaigns');
            return res.status(200).json({
                success: true,
                reason: 'no_matching_recipients',
                sent: 0,
                debug: {
                    activeCampaigns: activeCampaigns.length,
                    assigneeIds,
                    selectedRecipientIds,
                    selectedEmails: [...selectedEmails],
                    assigneeEmails: assigneeIds.map(id => assigneeIdToEmail.get(id)),
                },
                logs
            });
        }

        // Send emails
        let sent = 0;
        let failed = 0;

        for (const [email, campaigns] of emailsToSend) {
            const name = emailToName.get(email) || email;
            const html = buildEmailHTML(name, campaigns, turkeyDateStr);
            const subject = `Günlük Bülten - ${turkeyDateStr} (${campaigns.length} Kampanya)`;

            log(`Sending to ${email} (${name}): ${campaigns.length} campaigns`);

            const result = await sendEmail(settings.resendApiKey!, email, subject, html);

            if (result.success) {
                log(`✅ Sent to ${email}`);
                sent++;
            } else {
                log(`❌ Failed to send to ${email}: ${result.error}`);
                failed++;
            }
        }

        log(`=== DONE: sent=${sent}, failed=${failed} ===`);

        return res.status(200).json({
            success: true,
            sent,
            failed,
            logs,
        });

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        log(`❌ ERROR: ${errMsg}`);
        console.error(error);
        return res.status(500).json({
            success: false,
            error: errMsg,
            logs,
        });
    }
}
