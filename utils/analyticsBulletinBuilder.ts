import { AnalyticsTask, AnalyticsUser } from '../types';

interface AnalyticsBulletinContent {
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
 * Build analytics bulletin content for a specific user
 */
export function buildAnalyticsBulletin(
  analyticsTasks: AnalyticsTask[],
  userId: string,
  targetDate: Date = new Date()
): AnalyticsBulletinContent {
  // Filter analytics tasks for this user and date (active tasks: not cancelled or completed)
  const userTasks = analyticsTasks.filter(t => {
    const dateMatch = isSameDay(t.date, targetDate);
    const userMatch = t.assigneeId === userId;
    const statusOk = t.status !== 'İptal Edildi' && t.status !== 'Tamamlandı';
    return dateMatch && userMatch && statusOk;
  });

  return {
    analyticsTasks: userTasks,
    date: targetDate,
    totalCount: userTasks.length
  };
}
