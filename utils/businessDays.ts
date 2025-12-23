import { addDays, isWeekend, format } from 'date-fns';
import { TURKISH_HOLIDAYS } from '../constants';

/**
 * Check if a date is a Turkish holiday
 */
export function isHoliday(date: Date): boolean {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dateStr in TURKISH_HOLIDAYS;
}

/**
 * Get the next business day from a given date
 * Skips weekends and Turkish holidays
 */
export function getNextBusinessDay(date: Date): Date {
    let result = new Date(date);

    while (isWeekend(result) || isHoliday(result)) {
        result = addDays(result, 1);
    }

    return result;
}

/**
 * Calculate report due date from campaign completion
 * 30 days after completion, adjusted to next business day
 */
export function calculateReportDueDate(completionDate: Date): Date {
    const thirtyDaysLater = addDays(completionDate, 30);
    return getNextBusinessDay(thirtyDaysLater);
}
