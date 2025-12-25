import { db } from '../firebase';
import { collection, query, where, getDocs, setDoc, doc, Timestamp, getDoc } from 'firebase/firestore';
import { CalendarEvent, MonthlyChampion } from '../types';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export const calculateMonthlyChampion = async (force: boolean = false, referenceDate: Date = new Date()): Promise<MonthlyChampion | null> => {
  const now = referenceDate;
  // We want to calculate the champion for the *previous* month
  const lastMonthDate = subMonths(now, 1);
  const targetMonthStr = format(lastMonthDate, 'yyyy-MM');

  console.log(`🏆 Gamification: Checking champion for ${targetMonthStr}... (Force: ${force})`);

  try {
    // 1. Check if we already have a champion calculated for this month
    const settingsRef = doc(db, "system_settings", "monthly_champion");

    if (!force) {
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        const data = settingsSnap.data() as MonthlyChampion;
        // If the stored data matches the target month (last month) OR is newer (e.g. test mode for current month), return it.
        // This prevents overwriting a "future" test calculation with an "old" automatic calculation.
        if (data.month >= targetMonthStr) {
          console.log(`🏆 Gamification: Champion already exists or is newer (${data.month} >= ${targetMonthStr}): ${data.userIds?.join(', ') || data.userId}`);
          return data;
        }
      }
    }

    // 2. If not calculated (or old data), calculate it now.
    console.log(`🏆 Gamification: Calculating new champion for ${targetMonthStr}...`);

    const start = startOfMonth(lastMonthDate);
    const end = endOfMonth(lastMonthDate);

    // Query events for the previous month
    const eventsRef = collection(db, "events");
    // Note: Firestore doesn't support multiple inequality filters on different fields easily without composite indexes.
    // We will query by date range and filter by status in memory (safer for this scale).
    const q = query(
      eventsRef,
      where("date", ">=", Timestamp.fromDate(start)),
      where("date", "<=", Timestamp.fromDate(end))
    );

    const snapshot = await getDocs(q);
    const events: CalendarEvent[] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CalendarEvent));

    // 3. Process events
    const userCounts: Record<string, number> = {};

    events.forEach(event => {
      // Only count completed events with an assignee
      if (event.status === 'Tamamlandı' && event.assigneeId) {
        userCounts[event.assigneeId] = (userCounts[event.assigneeId] || 0) + 1;
      }
    });

    console.log('🏆 Gamification: User Counts:', userCounts);

    // 4. Find the winner(s) - supports ties
    let maxCount = 0;

    // First pass: find the maximum count
    Object.values(userCounts).forEach(count => {
      if (count > maxCount) {
        maxCount = count;
      }
    });

    // Second pass: find all users with the maximum count
    const winnerIds: string[] = [];
    Object.entries(userCounts).forEach(([userId, count]) => {
      if (count === maxCount) {
        winnerIds.push(userId);
      }
    });

    console.log(`🏆 Gamification: Max count: ${maxCount}, Winners: ${winnerIds.join(', ')}`);

    // 5. Validation Rules
    // - Must have at least 3 campaigns
    const validWinners = maxCount >= 3 ? winnerIds : [];

    if (maxCount < 3) {
      console.log('🏆 Gamification: No winner. Max count is less than 3.');
    } else if (winnerIds.length > 1) {
      console.log(`🏆 Gamification: Tie! ${winnerIds.length} winners with ${maxCount} campaigns each.`);
    }

    // 6. Save the result
    const championData: MonthlyChampion = {
      userId: validWinners[0] || '', // Keep for backwards compatibility
      userIds: validWinners, // New array field
      month: targetMonthStr,
      campaignCount: maxCount,
      calculatedAt: new Date()
    };

    // Store in Firestore so we don't calculate again for this month
    await setDoc(settingsRef, championData);

    console.log(`🏆 Gamification: New champion(s) saved: ${validWinners.length > 0 ? validWinners.join(', ') : 'None'}`);

    return validWinners.length > 0 ? championData : null;

  } catch (error) {
    console.error("🏆 Gamification Error:", error);
    return null;
  }
};
