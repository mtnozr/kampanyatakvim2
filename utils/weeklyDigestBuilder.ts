/**
 * Weekly Digest Builder - Build content for weekly digest emails
 */

import { startOfWeek, endOfWeek, isBefore, isWithinInterval, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Report, CalendarEvent, User } from '../types';

export interface DigestContent {
    overdueReports: ReportWithDetails[];
    thisWeekCampaigns: CampaignWithDetails[];
    weekStart: Date;
    weekEnd: Date;
    totalOverdueReports: number;
    totalThisWeekCampaigns: number;
}

export interface ReportWithDetails {
    id: string;
    title: string;
    campaignTitle?: string;
    dueDate: Date;
    daysOverdue: number;
    assigneeId?: string;
    assigneeName: string;
}

export interface CampaignWithDetails {
    id: string;
    title: string;
    date: Date;
    urgency: string;
    urgencyLabel: string;
    assigneeId?: string;
    assigneeName: string;
    status?: string;
}

/**
 * Get user name by ID
 */
function getUserName(userId: string | undefined, users: User[]): string {
    if (!userId) return 'Atanmamış';
    const user = users.find(u => u.id === userId);
    return user?.name || 'Bilinmiyor';
}

/**
 * Get Turkish urgency label
 */
function getUrgencyLabel(urgency: string): string {
    const labels: Record<string, string> = {
        'Very High': 'Çok Yüksek',
        'High': 'Yüksek',
        'Medium': 'Orta',
        'Low': 'Düşük',
    };
    return labels[urgency] || urgency;
}

/**
 * Build weekly digest content
 * @param reports - All reports
 * @param campaigns - All campaigns
 * @param users - All users for name lookup
 * @param referenceDate - Date to use as "now" (defaults to today)
 */
export function buildWeeklyDigest(
    reports: Report[],
    campaigns: CalendarEvent[],
    users: User[],
    referenceDate: Date = new Date()
): DigestContent {
    const now = referenceDate;

    // Calculate week range (Monday-Sunday)
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday

    // 1. Find overdue reports (status='pending' AND dueDate < now)
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
        .sort((a, b) => b.daysOverdue - a.daysOverdue); // Most overdue first

    // 2. Find this week's campaigns (Monday-Sunday, all statuses except cancelled)
    const thisWeekCampaigns: CampaignWithDetails[] = campaigns
        .filter(campaign => {
            // Skip cancelled campaigns
            if (campaign.status === 'İptal Edildi') return false;

            // Check if date is within this week
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
            // Sort by date first
            if (a.date.getTime() !== b.date.getTime()) {
                return a.date.getTime() - b.date.getTime();
            }
            // Then by urgency (Very High > High > Medium > Low)
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

/**
 * Format week range as string
 */
export function formatWeekRange(weekStart: Date, weekEnd: Date): string {
    const startStr = format(weekStart, 'd MMMM', { locale: tr });
    const endStr = format(weekEnd, 'd MMMM yyyy', { locale: tr });
    return `${startStr} - ${endStr}`;
}

/**
 * Get week number in year
 */
export function getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
