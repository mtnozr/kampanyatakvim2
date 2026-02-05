/**
 * Report Delay Monitor - Check and send email notifications for overdue reports
 */

import { differenceInDays, isBefore, isWeekend } from 'date-fns';
import { Report, User, ReminderSettings } from '../types';
import { sendReportDelayEmail } from './emailService';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';

interface ProcessResult {
    sent: number;
    failed: number;
    skipped: number;
}

/**
 * Check if we already sent a notification for this report recently (within last 24 hours)
 */
async function wasRecentlySent(reportId: string): Promise<boolean> {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const logsRef = collection(db, 'reminderLogs');
        const q = query(
            logsRef,
            where('eventId', '==', reportId),
            where('eventType', '==', 'report'),
            where('sentAt', '>=', Timestamp.fromDate(yesterday))
        );

        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking recent notifications:', error);
        return false; // If check fails, allow sending to be safe
    }
}

/**
 * Log sent notification to Firestore
 */
async function logNotification(params: {
    reportId: string;
    reportTitle: string;
    recipientEmail: string;
    recipientName: string;
    status: 'success' | 'failed';
    errorMessage?: string;
    messageId?: string;
}): Promise<void> {
    try {
        await addDoc(collection(db, 'reminderLogs'), {
            eventId: params.reportId,
            eventType: 'report',
            eventTitle: params.reportTitle,
            recipientEmail: params.recipientEmail,
            recipientName: params.recipientName,
            urgency: 'High', // Overdue reports are always high urgency
            sentAt: Timestamp.now(),
            status: params.status,
            errorMessage: params.errorMessage,
            emailProvider: 'resend',
            messageId: params.messageId,
        });
    } catch (error) {
        console.error('Error logging notification:', error);
    }
}

/**
 * Process report delay notifications
 * @param reports - All reports from Firestore
 * @param users - All users for email lookup
 * @param settings - Reminder settings including API key and thresholds
 * @param testMode - If true, bypasses date checks and sends for all overdue reports
 */
export async function processReportDelayNotifications(
    reports: Report[],
    users: User[],
    settings: ReminderSettings,
    testMode: boolean = false
): Promise<ProcessResult> {
    const result: ProcessResult = { sent: 0, failed: 0, skipped: 0 };

    // Check if report delay notifications are enabled
    if (!settings.reportDelayNotificationsEnabled && !testMode) {
        console.log('Report delay notifications are disabled');
        return result;
    }

    // Check if we have API key
    if (!settings.resendApiKey) {
        console.error('Resend API key is not configured');
        return result;
    }

    const now = new Date();
    const threshold = settings.reportDelayThresholdDays || 0;

    // Skip weekends unless in test mode
    if (!testMode && isWeekend(now)) {
        console.log('Skipping report delay notifications on weekends');
        return result;
    }

    // Get CC recipient emails from settings
    const ccRecipientEmails: string[] = [];
    if (settings.emailCcRecipients && settings.emailCcRecipients.length > 0) {
        // Find users with matching IDs and get their emails
        for (const recipientId of settings.emailCcRecipients) {
            const ccUser = users.find(u => u.id === recipientId);
            if (ccUser && ccUser.email) {
                ccRecipientEmails.push(ccUser.email);
            }
        }
        console.log(`Found ${ccRecipientEmails.length} CC recipients for delay notifications`);
    }

    // Filter overdue reports (status = pending and dueDate < now)
    const overdueReports = reports.filter(report => {
        if (report.status !== 'pending') return false;
        if (!isBefore(report.dueDate, now)) return false;

        // Check threshold
        const daysOverdue = differenceInDays(now, report.dueDate);
        return daysOverdue >= threshold;
    });

    console.log(`Found ${overdueReports.length} overdue reports (threshold: ${threshold} days)`);

    // Process each overdue report
    for (const report of overdueReports) {
        // Skip if no assignee
        if (!report.assigneeId) {
            console.log(`Skipping report ${report.id}: No assignee`);
            result.skipped++;
            continue;
        }

        // Find assignee user
        const assignee = users.find(u => u.id === report.assigneeId);
        if (!assignee || !assignee.email) {
            console.log(`Skipping report ${report.id}: Assignee not found or no email`);
            result.skipped++;
            continue;
        }

        // Check if we already sent a notification recently (unless in test mode)
        if (!testMode) {
            const recentlySent = await wasRecentlySent(report.id);
            if (recentlySent) {
                console.log(`Skipping report ${report.id}: Notification sent in last 24 hours`);
                result.skipped++;
                continue;
            }
        }

        // Calculate days overdue
        const daysOverdue = differenceInDays(now, report.dueDate);

        // Send email with CC recipients
        try {
            const emailResult = await sendReportDelayEmail(
                settings.resendApiKey,
                assignee.email,
                assignee.name,
                {
                    id: report.id,
                    title: report.title,
                    campaignTitle: report.campaignTitle,
                },
                daysOverdue,
                ccRecipientEmails.length > 0 ? ccRecipientEmails : undefined
            );

            if (emailResult.success) {
                console.log(`✅ Sent report delay email to ${assignee.name} for "${report.title}"`);
                result.sent++;

                // Log success
                await logNotification({
                    reportId: report.id,
                    reportTitle: report.title,
                    recipientEmail: assignee.email,
                    recipientName: assignee.name,
                    status: 'success',
                    messageId: emailResult.messageId,
                });
            } else {
                console.error(`❌ Failed to send email to ${assignee.name}: ${emailResult.error}`);
                result.failed++;

                // Log failure
                await logNotification({
                    reportId: report.id,
                    reportTitle: report.title,
                    recipientEmail: assignee.email,
                    recipientName: assignee.name,
                    status: 'failed',
                    errorMessage: emailResult.error,
                });
            }
        } catch (error) {
            console.error(`Error sending email for report ${report.id}:`, error);
            result.failed++;

            // Log failure
            await logNotification({
                reportId: report.id,
                reportTitle: report.title,
                recipientEmail: assignee.email,
                recipientName: assignee.name,
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    return result;
}
