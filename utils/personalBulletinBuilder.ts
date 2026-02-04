import { CalendarEvent, AnalyticsTask, Report, User, AnalyticsUser } from '../types';

interface PersonalBulletinContent {
  campaigns: CalendarEvent[];
  reports: Report[];
  analyticsTasks: AnalyticsTask[];
  date: Date;
  totalCount: number;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Build personal bulletin content for a specific user
 */
export function buildPersonalBulletin(
  campaigns: CalendarEvent[],
  reports: Report[],
  analyticsTasks: AnalyticsTask[],
  userId: string,
  targetDate: Date = new Date()
): PersonalBulletinContent {
  console.log('>>> INSIDE buildPersonalBulletin <<<');
  console.log('UserId:', userId);
  console.log('TargetDate:', targetDate.toLocaleString('tr-TR'));
  console.log('TargetDate Y/M/D:', targetDate.getFullYear() + '/' + targetDate.getMonth() + '/' + targetDate.getDate());
  console.log('Total campaigns input:', campaigns.length);

  // Filter campaigns for this user and date (active campaigns: not cancelled or completed)
  const userCampaigns = campaigns.filter(c => {
    const dateMatch = isSameDay(c.date, targetDate);
    const userMatch = c.assigneeId === userId;
    const statusOk = c.status !== 'İptal Edildi' && c.status !== 'Tamamlandı';
    const result = dateMatch && userMatch && statusOk;

    if (userMatch && dateMatch) {
      console.log('  Campaign:', c.title,
        '| DateMatch:', dateMatch,
        '| UserMatch:', userMatch,
        '| StatusOk:', statusOk,
        '| Status:', c.status,
        '| INCLUDED:', result);
    }

    return result;
  });

  console.log('Filtered userCampaigns:', userCampaigns.length);
  console.log('<<< END buildPersonalBulletin >>>');

  // Filter reports for this user and date
  const userReports = reports.filter(r =>
    isSameDay(r.dueDate, targetDate) &&
    r.assigneeId === userId &&
    r.status !== 'done'
  );

  // Filter analytics tasks for this user and date
  const userTasks = analyticsTasks.filter(t =>
    isSameDay(t.date, targetDate) &&
    t.assigneeId === userId &&
    t.status !== 'İptal Edildi'
  );

  const totalCount = userCampaigns.length + userReports.length + userTasks.length;

  return {
    campaigns: userCampaigns,
    reports: userReports,
    analyticsTasks: userTasks,
    date: targetDate,
    totalCount
  };
}
