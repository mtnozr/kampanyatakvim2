/**
 * Daily Digest Builder - Build content for end-of-day digest emails
 */

import { format, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarEvent, User } from '../types';

export interface DailyDigestContent {
    completedCampaigns: DailyCampaignDetails[];
    incompleteCampaigns: DailyCampaignDetails[];
    date: Date;
    totalCompleted: number;
    totalIncomplete: number;
}

export interface DailyCampaignDetails {
    id: string;
    title: string;
    assigneeName: string;
    status: string;
    urgencyLabel: string;
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
 * Build daily digest content
 * @param campaigns - All campaigns
 * @param users - All users for name lookup
 * @param targetDate - Date to generate digest for (defaults to today)
 */
export function buildDailyDigest(
    campaigns: CalendarEvent[],
    users: User[],
    targetDate: Date = new Date()
): DailyDigestContent {

    // Filter campaigns for the target date
    const todaysCampaigns = campaigns.filter(campaign =>
        isSameDay(campaign.date, targetDate) && campaign.status !== 'İptal Edildi'
    );

    // Categorize into Completed vs Incomplete
    const completedCampaigns: DailyCampaignDetails[] = [];
    const incompleteCampaigns: DailyCampaignDetails[] = [];

    todaysCampaigns.forEach(campaign => {
        const details: DailyCampaignDetails = {
            id: campaign.id,
            title: campaign.title,
            assigneeName: getUserName(campaign.assigneeId, users),
            status: campaign.status || 'Planlandı',
            urgencyLabel: getUrgencyLabel(campaign.urgency)
        };

        if (campaign.status === 'Tamamlandı') {
            completedCampaigns.push(details);
        } else {
            incompleteCampaigns.push(details);
        }
    });

    return {
        completedCampaigns,
        incompleteCampaigns,
        date: targetDate,
        totalCompleted: completedCampaigns.length,
        totalIncomplete: incompleteCampaigns.length
    };
}
