import { db } from '../firebase';
import { collection, query, where, getDocs, setDoc, doc, Timestamp, getDoc } from 'firebase/firestore';
import { CalendarEvent, MonthlyChampion } from '../types';
import { startOfMonth, endOfMonth, subMonths, format, differenceInHours, isValid } from 'date-fns';

// Helper to get completion time for an event (in hours)
const getCompletionTime = (event: CalendarEvent): number | null => {
  // Start date: originalDate or date (first assigned date)
  const startDate = event.originalDate || event.date;
  if (!startDate || !isValid(startDate)) return null;

  // End date: Find status change to Tamamlandı in history
  let endDate: Date | null = null;

  if (event.history && event.history.length > 0) {
    const completionChange = [...event.history].reverse().find(
      h => h.newStatus === 'Tamamlandı'
    );
    if (completionChange?.date && isValid(completionChange.date)) {
      endDate = completionChange.date;
    }
  }

  // Fallback to updatedAt
  if (!endDate && event.updatedAt && isValid(event.updatedAt)) {
    endDate = event.updatedAt;
  }

  if (!endDate || !isValid(endDate)) return null;

  try {
    const hours = differenceInHours(endDate, startDate);
    return hours >= 0 ? hours : null;
  } catch {
    return null;
  }
};

export const calculateMonthlyChampion = async (force: boolean = false, referenceDate: Date = new Date()): Promise<MonthlyChampion | null> => {
  const now = referenceDate;
  const lastMonthDate = subMonths(now, 1);
  const targetMonthStr = format(lastMonthDate, 'yyyy-MM');

  console.log(`🏆 Gamification: Checking champion for ${targetMonthStr}... (Force: ${force})`);

  try {
    const settingsRef = doc(db, "system_settings", "monthly_champion");

    if (!force) {
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const data = settingsSnap.data() as MonthlyChampion;
        if (data.month >= targetMonthStr) {
          console.log(`🏆 Gamification: Data exists for ${data.month}`);
          return data;
        }
      }
    }

    console.log(`🏆 Gamification: Calculating new champions for ${targetMonthStr}...`);

    const start = startOfMonth(lastMonthDate);
    const end = endOfMonth(lastMonthDate);

    const eventsRef = collection(db, "events");
    const q = query(
      eventsRef,
      where("date", ">=", Timestamp.fromDate(start)),
      where("date", "<=", Timestamp.fromDate(end))
    );

    const snapshot = await getDocs(q);
    const events: CalendarEvent[] = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as CalendarEvent));

    // === BADGE 1: 🏆 Trophy - Most Completed ===
    const userCounts: Record<string, number> = {};

    // === BADGE 2: 🚀 Rocket - Fastest Average ===
    const userTotalHours: Record<string, number> = {};
    const userCompletedCount: Record<string, number> = {};

    // === BADGE 3: 💪 Power - Most Hard Campaigns ===
    const userHardCounts: Record<string, number> = {};

    events.forEach(event => {
      if (event.status === 'Tamamlandı' && event.assigneeId) {
        const userId = event.assigneeId;

        // Trophy: Count completions
        userCounts[userId] = (userCounts[userId] || 0) + 1;

        // Rocket: Track completion time
        const hours = getCompletionTime(event);
        if (hours !== null) {
          userTotalHours[userId] = (userTotalHours[userId] || 0) + hours;
          userCompletedCount[userId] = (userCompletedCount[userId] || 0) + 1;
        }

        // Power: Count hard campaigns (Zor or Çok Zor)
        if (event.difficulty === 'ZOR' || event.difficulty === 'ÇOK ZOR') {
          userHardCounts[userId] = (userHardCounts[userId] || 0) + 1;
        }
      }
    });

    // === Calculate Trophy Winners (🏆) ===
    let maxCount = 0;
    Object.values(userCounts).forEach(count => { if (count > maxCount) maxCount = count; });
    const trophyWinners = maxCount >= 3
      ? Object.entries(userCounts).filter(([, c]) => c === maxCount).map(([id]) => id)
      : [];

    console.log(`🏆 Trophy: Max ${maxCount}, Winners: ${trophyWinners.join(', ') || 'None'}`);

    // === Calculate Rocket Winners (🚀) ===
    const userAvgHours: Record<string, number> = {};
    Object.entries(userTotalHours).forEach(([userId, total]) => {
      const count = userCompletedCount[userId] || 1;
      if (count >= 3) { // Minimum 3 campaigns to qualify
        userAvgHours[userId] = total / count;
      }
    });

    let minAvgHours = Infinity;
    Object.values(userAvgHours).forEach(avg => { if (avg < minAvgHours) minAvgHours = avg; });
    const rocketWinners = minAvgHours < Infinity
      ? Object.entries(userAvgHours).filter(([, avg]) => avg === minAvgHours).map(([id]) => id)
      : [];

    console.log(`🚀 Rocket: Min avg ${minAvgHours}hrs, Winners: ${rocketWinners.join(', ') || 'None'}`);

    // === Calculate Power Winners (💪) ===
    let maxHardCount = 0;
    Object.values(userHardCounts).forEach(count => { if (count > maxHardCount) maxHardCount = count; });
    const powerWinners = maxHardCount >= 2 // Minimum 2 hard campaigns
      ? Object.entries(userHardCounts).filter(([, c]) => c === maxHardCount).map(([id]) => id)
      : [];

    console.log(`💪 Power: Max ${maxHardCount}, Winners: ${powerWinners.join(', ') || 'None'}`);

    // === Save Results ===
    const championData: MonthlyChampion = {
      userId: trophyWinners[0] || '',
      userIds: trophyWinners,
      fastestUserIds: rocketWinners,
      hardestUserIds: powerWinners,
      month: targetMonthStr,
      campaignCount: maxCount,
      fastestAvgHours: minAvgHours < Infinity ? Math.round(minAvgHours) : undefined,
      hardestCount: maxHardCount > 0 ? maxHardCount : undefined,
      calculatedAt: new Date()
    };

    await setDoc(settingsRef, championData);

    const hasAnyWinner = trophyWinners.length > 0 || rocketWinners.length > 0 || powerWinners.length > 0;
    console.log(`🏆 Gamification: Saved! Trophy: ${trophyWinners.length}, Rocket: ${rocketWinners.length}, Power: ${powerWinners.length}`);

    return hasAnyWinner ? championData : null;

  } catch (error) {
    console.error("🏆 Gamification Error:", error);
    return null;
  }
};
