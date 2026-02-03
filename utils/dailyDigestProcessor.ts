/**
 * Daily Digest Processor - Process and send daily digest emails automatically
 * Server-Side Version (Uses Firebase Admin SDK)
 */

import { CalendarEvent, User, ReminderSettings } from '../types';
import { buildDailyDigest, DailyDigestContent } from './dailyDigestBuilder';
import { buildDailyDigestHTML } from './emailService';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

interface DepartmentUser {
    id: string;
    username: string;
    name?: string;
    email?: string;
    isDesigner?: boolean;
}

interface ProcessResult {
    sent: number;
    failed: number;
    skipped: number;
}

/**
 * Send email directly using Resend API (Server-Side compatible)
 */
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

/**
 * Check if digest was already sent today
 */
async function checkDigestAlreadySent(db: Firestore, dateStr: string): Promise<boolean> {
    try {
        const logsRef = db.collection('reminderLogs');
        const snapshot = await logsRef
            .where('eventId', '==', `daily-digest-${dateStr}`)
            .where('status', '==', 'success')
            .limit(1)
            .get();

        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking existing digest:', error);
        return false;
    }
}

/**
 * Try to acquire a lock for today's digest
 * Returns true if lock acquired, false if already locked/sent
 */
async function acquireDailyDigestLock(db: Firestore, dateStr: string): Promise<boolean> {
    const lockRef = db.collection('systemLocks').doc(`daily-digest-${dateStr}`);

    try {
        return await db.runTransaction(async (transaction) => {
            const lockDoc = await transaction.get(lockRef);

            if (lockDoc.exists) {
                // Already locked/sent
                return false;
            }

            // Create lock
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

/**
 * Log daily digest send to Firestore
 */
async function logDailyDigest(db: Firestore, params: {
    recipientEmail: string;
    recipientName: string;
    status: 'success' | 'failed';
    digestContent: DailyDigestContent;
    errorMessage?: string;
    messageId?: string;
}): Promise<void> {
    try {
        const dateStr = params.digestContent.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

        await db.collection('reminderLogs').add({
            eventId: `daily-digest-${params.digestContent.date.toISOString().split('T')[0]}`,
            eventType: 'daily-digest',
            eventTitle: `Gün Sonu Bülteni - ${dateStr}`,
            recipientEmail: params.recipientEmail,
            recipientName: params.recipientName,
            urgency: 'Medium',
            sentAt: Timestamp.now(),
            status: params.status,
            errorMessage: params.errorMessage,
            emailProvider: 'resend',
            messageId: params.messageId,
            digestStats: {
                completedCount: params.digestContent.totalCompleted,
                incompleteCount: params.digestContent.totalIncomplete,
            },
        });
    } catch (error) {
        console.error('Error logging daily digest:', error);
    }
}

/**
 * Process and send daily digest emails to all designer users
 * @param db - Admin Firestore instance
 * @param campaigns - All campaigns
 * @param users - All users for name lookup
 * @param departmentUsers - Department users to filter designers
 * @param settings - Reminder settings including API key and digest config
 */
export async function processDailyDigest(
    db: Firestore,
    campaigns: CalendarEvent[],
    users: User[],
    departmentUsers: DepartmentUser[],
    settings: ReminderSettings
): Promise<ProcessResult> {
    const result: ProcessResult = { sent: 0, failed: 0, skipped: 0 };
    const now = new Date();

    // Check if daily digest is enabled
    if (!settings.dailyDigestEnabled) {
        // console.log('Daily digest is disabled');
        return result;
    }

    // Check if valid time set
    if (!settings.dailyDigestTime) {
        return result;
    }

    // Parse configured time
    const [targetHour, targetMinute] = settings.dailyDigestTime.split(':').map(Number);

    // Check if current time matching (within a reasonable window, e.g. same hour)
    // We assume this runs frequently, so we check if NOW >= Target Time
    // And we check if we already sent it TODAY to avoid duplicates.
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Only process if it's time (current hour > target OR same hour and passed minute)
    const isTime = currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);

    if (!isTime) {
        return result;
    }

    // Check if duplicate for today using Transaction Lock
    const todayStr = now.toISOString().split('T')[0];

    // First fast check using logs (optimization)
    const alreadySent = await checkDigestAlreadySent(db, todayStr);
    if (alreadySent) {
        console.log('Daily digest already sent for today (log check), skipping.');
        return result;
    }

    // Try to acquire distributed lock
    console.log(`Attempting to acquire lock for daily-digest-${todayStr}...`);
    const lockAcquired = await acquireDailyDigestLock(db, todayStr);

    if (!lockAcquired) {
        console.log('Could not acquire lock for daily digest, another instance is likely processing it.');
        return result;
    }

    console.log('Lock acquired! Processing daily digest...');

    // Check if we have API key
    if (!settings.resendApiKey) {
        console.error('Resend API key is not configured');
        return result;
    }

    // Build digest content
    console.log('Building daily digest content...');
    const digestContent = buildDailyDigest(campaigns, users, now);

    // Filter designer users who have email and are in the selected CC list
    const designerUsers = departmentUsers.filter(user => {
        const isSelected = (settings.emailCcRecipients || []).includes(user.id);
        return user.isDesigner && user.email && isSelected;
    });

    if (designerUsers.length === 0) {
        console.log('No designer users found with email addresses for daily digest');
        return result;
    }

    console.log(`Found ${designerUsers.length} designer users to send daily digest`);

    // Send email to each designer user
    for (const designer of designerUsers) {
        try {
            // Generate HTML
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
                console.log(`✅ Sent daily digest to ${designer.name || designer.username} (${designer.email})`);
                result.sent++;

                // Log success
                await logDailyDigest(db, {
                    recipientEmail: designer.email!,
                    recipientName: designer.name || designer.username,
                    status: 'success',
                    digestContent,
                    messageId: emailResult.messageId,
                });
            } else {
                console.error(`❌ Failed to send daily digest to ${designer.name}: ${emailResult.error}`);
                result.failed++;

                // Log failure
                await logDailyDigest(db, {
                    recipientEmail: designer.email!,
                    recipientName: designer.name || designer.username,
                    status: 'failed',
                    digestContent,
                    errorMessage: emailResult.error,
                });
            }
        } catch (error) {
            console.error(`Error sending daily digest to ${designer.name}:`, error);
            result.failed++;

            // Log failure
            await logDailyDigest(db, {
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
