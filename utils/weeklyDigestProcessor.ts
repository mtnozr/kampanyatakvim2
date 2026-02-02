/**
 * Weekly Digest Processor - Process and send weekly digest emails
 */

import { Report, CalendarEvent, User, ReminderSettings } from '../types';
import { buildWeeklyDigest, DigestContent } from './weeklyDigestBuilder';
import { sendWeeklyDigestEmail } from './emailService';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

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
 * Log weekly digest send to Firestore
 */
async function logWeeklyDigest(params: {
    recipientEmail: string;
    recipientName: string;
    status: 'success' | 'failed';
    digestContent: DigestContent;
    errorMessage?: string;
    messageId?: string;
}): Promise<void> {
    try {
        const weekRangeStr = `${params.digestContent.weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} - ${params.digestContent.weekEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

        await addDoc(collection(db, 'reminderLogs'), {
            eventId: `weekly-digest-${params.digestContent.weekStart.toISOString().split('T')[0]}`,
            eventType: 'weekly-digest',
            eventTitle: `Haftalık Bülten - ${weekRangeStr}`,
            recipientEmail: params.recipientEmail,
            recipientName: params.recipientName,
            urgency: 'Medium',
            sentAt: Timestamp.now(),
            status: params.status,
            errorMessage: params.errorMessage,
            emailProvider: 'resend',
            messageId: params.messageId,
            digestStats: {
                overdueReportsCount: params.digestContent.totalOverdueReports,
                thisWeekCampaignsCount: params.digestContent.totalThisWeekCampaigns,
            },
        });
    } catch (error) {
        console.error('Error logging weekly digest:', error);
    }
}

/**
 * Process and send weekly digest emails to all designer users
 * @param reports - All reports
 * @param campaigns - All campaigns
 * @param users - All users for name lookup
 * @param departmentUsers - Department users to filter designers
 * @param settings - Reminder settings including API key and digest config
 */
export async function processWeeklyDigest(
    reports: Report[],
    campaigns: CalendarEvent[],
    users: User[],
    departmentUsers: DepartmentUser[],
    settings: ReminderSettings
): Promise<ProcessResult> {
    const result: ProcessResult = { sent: 0, failed: 0, skipped: 0 };

    // Check if weekly digest is enabled
    if (!settings.weeklyDigestEnabled) {
        console.log('Weekly digest is disabled');
        return result;
    }

    // Check if we have API key
    if (!settings.resendApiKey) {
        console.error('Resend API key is not configured');
        return result;
    }

    // Build digest content
    console.log('Building weekly digest content...');
    const digestContent = buildWeeklyDigest(reports, campaigns, users);

    console.log(`Digest content: ${digestContent.totalOverdueReports} overdue reports, ${digestContent.totalThisWeekCampaigns} campaigns this week`);

    // Filter designer users who have email and are in the selected CC list
    const designerUsers = departmentUsers.filter(user => {
        const isSelected = (settings.emailCcRecipients || []).includes(user.id);
        return user.isDesigner && user.email && isSelected;
    });

    if (designerUsers.length === 0) {
        console.log('No designer users found with email addresses');
        return result;
    }

    console.log(`Found ${designerUsers.length} designer users to send digest`);

    // Send email to each designer user
    for (const designer of designerUsers) {
        try {
            const emailResult = await sendWeeklyDigestEmail(
                settings.resendApiKey,
                designer.email!,
                designer.name || designer.username,
                digestContent,
                digestContent.weekStart,
                digestContent.weekEnd
            );

            if (emailResult.success) {
                console.log(`✅ Sent weekly digest to ${designer.name || designer.username} (${designer.email})`);
                result.sent++;

                // Log success
                await logWeeklyDigest({
                    recipientEmail: designer.email!,
                    recipientName: designer.name || designer.username,
                    status: 'success',
                    digestContent,
                    messageId: emailResult.messageId,
                });
            } else {
                console.error(`❌ Failed to send digest to ${designer.name}: ${emailResult.error}`);
                result.failed++;

                // Log failure
                await logWeeklyDigest({
                    recipientEmail: designer.email!,
                    recipientName: designer.name || designer.username,
                    status: 'failed',
                    digestContent,
                    errorMessage: emailResult.error,
                });
            }
        } catch (error) {
            console.error(`Error sending digest to ${designer.name}:`, error);
            result.failed++;

            // Log failure
            await logWeeklyDigest({
                recipientEmail: designer.email!,
                recipientName: designer.name || designer.username,
                status: 'failed',
                digestContent,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    console.log(`Weekly digest processing complete: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
    return result;
}
