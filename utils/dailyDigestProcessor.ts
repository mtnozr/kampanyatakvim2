/**
 * Daily Digest Processor - Process and send daily digest emails automatically
 */

import { CalendarEvent, User, ReminderSettings } from '../types';
import { buildDailyDigest, DailyDigestContent } from './dailyDigestBuilder';
import { sendDailyDigestEmail } from './emailService';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, query, where, getDocs, limit, runTransaction, doc } from 'firebase/firestore';

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
 * Check if digest was already sent today
 */
async function checkDigestAlreadySent(dateStr: string): Promise<boolean> {
    try {
        const logsRef = collection(db, 'reminderLogs');
        const q = query(
            logsRef,
            where('eventId', '==', `daily-digest-${dateStr}`),
            where('status', '==', 'success'),
            limit(1)
        );
        const snapshot = await getDocs(q);
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
async function acquireDailyDigestLock(dateStr: string): Promise<boolean> {
    const lockRef = doc(db, 'systemLocks', `daily-digest-${dateStr}`);

    try {
        return await runTransaction(db, async (transaction) => {
            const lockDoc = await transaction.get(lockRef);

            if (lockDoc.exists()) {
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
async function logDailyDigest(params: {
    recipientEmail: string;
    recipientName: string;
    status: 'success' | 'failed';
    digestContent: DailyDigestContent;
    errorMessage?: string;
    messageId?: string;
}): Promise<void> {
    try {
        const dateStr = params.digestContent.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

        await addDoc(collection(db, 'reminderLogs'), {
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
 * @param campaigns - All campaigns
 * @param users - All users for name lookup
 * @param departmentUsers - Department users to filter designers
 * @param settings - Reminder settings including API key and digest config
 */
export async function processDailyDigest(
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
    const alreadySent = await checkDigestAlreadySent(todayStr);
    if (alreadySent) {
        console.log('Daily digest already sent for today (log check), skipping.');
        return result;
    }

    // Try to acquire distributed lock
    console.log(`Attempting to acquire lock for daily-digest-${todayStr}...`);
    const lockAcquired = await acquireDailyDigestLock(todayStr);

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
            const emailResult = await sendDailyDigestEmail(
                settings.resendApiKey,
                designer.email!,
                designer.name || designer.username,
                digestContent
            );

            if (emailResult.success) {
                console.log(`✅ Sent daily digest to ${designer.name || designer.username} (${designer.email})`);
                result.sent++;

                // Log success
                await logDailyDigest({
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
                await logDailyDigest({
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
            await logDailyDigest({
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

