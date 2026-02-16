import React, { useMemo, useRef, useEffect, useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, isSameMonth, isToday, startOfMonth, eachDayOfInterval, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarEvent, Report, AnalyticsTask, User, AnalyticsUser } from '../../types';
import { Plus, ChevronLeft, ChevronRight, LogIn, UserPlus, CalendarDays, FileText, BarChart3, Inbox } from 'lucide-react';
import { URGENCY_CONFIGS } from '../../constants';
import MobileBottomNav, { MobileTabKey } from './MobileBottomNav';

interface MobileShellProps {
  currentDate: Date;
  onPrevPeriod: () => void;
  onNextPeriod: () => void;
  onResetToToday: () => void;
  events: CalendarEvent[];
  reports: Report[];
  analyticsTasks: AnalyticsTask[];
  users: User[];
  analyticsUsers: AnalyticsUser[];
  activeTab: MobileTabKey;
  onChangeTab: (tab: MobileTabKey) => void;
  canSeeKampanyaTab: boolean;
  canSeeReportTab: boolean;
  canSeeAnalyticsTab: boolean;
  canAddCampaign: boolean;
  canAddAnalytics: boolean;
  onOpenEvent: (eventId: string) => void;
  onOpenReport: (reportId: string) => void;
  onOpenAnalyticsTask: (taskId: string) => void;
  onOpenAddCampaign: () => void;
  onOpenAddAnalytics: () => void;
  onOpenMyTasks: () => void;
  onOpenLogin: () => void;
  isLoggedIn: boolean;
}

const userNameById = (users: User[]) => {
  const map = new Map<string, string>();
  users.forEach((user) => map.set(user.id, user.name));
  return map;
};

const analyticsNameById = (users: AnalyticsUser[]) => {
  const map = new Map<string, string>();
  users.forEach((user) => map.set(user.id, user.name));
  return map;
};

type MobileStatus = 'Planlandı' | 'Tamamlandı' | 'Bekleme' | 'İptal Edildi';

const normalizeCampaignStatus = (status?: string): MobileStatus => {
  if (status === 'Tamamlandı') return 'Tamamlandı';
  if (status === 'Bekleme') return 'Bekleme';
  if (status === 'İptal Edildi') return 'İptal Edildi';
  return 'Planlandı';
};

const normalizeReportStatus = (status?: string): MobileStatus => {
  if (status === 'done') return 'Tamamlandı';
  if (status === 'cancelled') return 'İptal Edildi';
  return 'Planlandı';
};

const getStatusStyle = (status: MobileStatus) => {
  switch (status) {
    case 'Tamamlandı':
      return {
        label: 'Tamamlandı',
        badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40',
        dotClass: 'bg-emerald-500',
        stripeClass: 'bg-emerald-500'
      };
    case 'Planlandı':
      return {
        label: 'Planlandı',
        badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40',
        dotClass: 'bg-blue-500',
        stripeClass: 'bg-blue-500'
      };
    case 'Bekleme':
      return {
        label: 'Beklemede',
        badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40',
        dotClass: 'bg-amber-500',
        stripeClass: 'bg-amber-500'
      };
    case 'İptal Edildi':
      return {
        label: 'İptal',
        badgeClass: 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40',
        dotClass: 'bg-red-500',
        stripeClass: 'bg-red-500'
      };
    default:
      return {
        label: 'Planlandı',
        badgeClass: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600',
        dotClass: 'bg-gray-400',
        stripeClass: 'bg-gray-300'
      };
  }
};

// --- Empty State Component ---
const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6">
    <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-gray-400 dark:text-gray-500">
      {icon}
    </div>
    <p className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">{title}</p>
    <p className="text-sm text-gray-400 dark:text-gray-500 text-center leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium shadow-sm active:scale-95 transition-transform"
      >
        <Plus size={16} />
        {actionLabel}
      </button>
    )}
  </div>
);

// --- Mini Calendar Strip ---
const DAY_LABELS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

const MiniCalendarStrip: React.FC<{
  currentDate: Date;
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  eventDates: Set<string>;
}> = ({ currentDate, selectedDate, onSelectDate, eventDates }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = todayRef.current;
      const scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [currentDate]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-1 overflow-x-auto py-2 px-3 scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {days.map((day) => {
        const dayKey = format(day, 'yyyy-MM-dd');
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isTodayDate = isToday(day);
        const hasEvent = eventDates.has(dayKey);
        const dayOfWeek = (day.getDay() + 6) % 7; // Monday=0

        return (
          <button
            key={dayKey}
            ref={isTodayDate ? todayRef : undefined}
            onClick={() => onSelectDate(isSelected ? null : day)}
            className={`flex flex-col items-center flex-shrink-0 w-10 py-1.5 rounded-xl transition-all ${
              isSelected
                ? 'bg-violet-600 text-white shadow-md shadow-violet-200 dark:shadow-violet-900/40'
                : isTodayDate
                  ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                  : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <span className={`text-[10px] font-medium ${isSelected ? 'text-violet-200' : 'text-gray-400 dark:text-gray-500'}`}>
              {DAY_LABELS[dayOfWeek]}
            </span>
            <span className={`text-sm font-bold mt-0.5 ${isSelected ? 'text-white' : ''}`}>
              {format(day, 'd')}
            </span>
            <div className={`w-1 h-1 rounded-full mt-0.5 ${
              hasEvent
                ? isSelected ? 'bg-white' : 'bg-violet-500 dark:bg-violet-400'
                : 'bg-transparent'
            }`} />
          </button>
        );
      })}
    </div>
  );
};

export const MobileShell: React.FC<MobileShellProps> = ({
  currentDate,
  onPrevPeriod,
  onNextPeriod,
  onResetToToday,
  events,
  reports,
  analyticsTasks,
  users,
  analyticsUsers,
  activeTab,
  onChangeTab,
  canSeeKampanyaTab,
  canSeeReportTab,
  canSeeAnalyticsTab,
  canAddCampaign,
  canAddAnalytics,
  onOpenEvent,
  onOpenReport,
  onOpenAnalyticsTask,
  onOpenAddCampaign,
  onOpenAddAnalytics,
  onOpenMyTasks,
  onOpenLogin,
  isLoggedIn,
}) => {
  const userMap = useMemo(() => userNameById(users), [users]);
  const analyticsMap = useMemo(() => analyticsNameById(analyticsUsers), [analyticsUsers]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Reset selected date when month changes
  useEffect(() => {
    setSelectedDate(null);
  }, [currentDate]);

  // Build event date sets for the dot indicators on the calendar strip
  const eventDateSet = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => set.add(format(e.date, 'yyyy-MM-dd')));
    return set;
  }, [events]);

  const reportDateSet = useMemo(() => {
    const set = new Set<string>();
    reports.forEach(r => set.add(format(r.dueDate, 'yyyy-MM-dd')));
    return set;
  }, [reports]);

  const analyticsDateSet = useMemo(() => {
    const set = new Set<string>();
    analyticsTasks.forEach(t => set.add(format(t.date, 'yyyy-MM-dd')));
    return set;
  }, [analyticsTasks]);

  const activeDateSet = activeTab === 'kampanya' ? eventDateSet
    : activeTab === 'rapor' ? reportDateSet
    : activeTab === 'analitik' ? analyticsDateSet
    : eventDateSet;

  const sortedEvents = useMemo(() => {
    let filtered = [...events];
    if (selectedDate) {
      filtered = filtered.filter(e => isSameDay(e.date, selectedDate));
    }
    return filtered.sort((a, b) => {
      const aStatus = a.status || 'Planlandı';
      const bStatus = b.status || 'Planlandı';
      const aRank = aStatus === 'Planlandı' ? 0 : 1;
      const bRank = bStatus === 'Planlandı' ? 0 : 1;

      if (aRank !== bRank) return aRank - bRank;
      return a.date.getTime() - b.date.getTime();
    });
  }, [events, selectedDate]);

  const sortedReports = useMemo(() => {
    let filtered = [...reports];
    if (selectedDate) {
      filtered = filtered.filter(r => isSameDay(r.dueDate, selectedDate));
    }
    return filtered.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [reports, selectedDate]);

  const sortedAnalyticsTasks = useMemo(() => {
    let filtered = [...analyticsTasks];
    if (selectedDate) {
      filtered = filtered.filter(t => isSameDay(t.date, selectedDate));
    }
    return filtered.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [analyticsTasks, selectedDate]);

  // Determine if filtering by date (for empty state messaging)
  const isDateFiltered = selectedDate !== null;

  return (
    <div className="min-h-screen bg-[#F8F9FE] dark:bg-slate-900 text-gray-900 dark:text-gray-100 pb-20">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-gray-200 dark:border-slate-700">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold">Kampanya Takvimi</h1>
            {!isLoggedIn && (
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-teal-600 text-white"
              >
                <LogIn size={14} />
                Giriş
              </button>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button onClick={onPrevPeriod} className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 active:scale-95 transition-transform">
              <ChevronLeft size={16} />
            </button>
            <button onClick={onResetToToday} className="text-sm font-semibold">
              {format(currentDate, 'MMMM yyyy', { locale: tr })}
            </button>
            <button onClick={onNextPeriod} className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 active:scale-95 transition-transform">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        {(activeTab === 'kampanya' || activeTab === 'rapor' || activeTab === 'analitik') && (
          <MiniCalendarStrip
            currentDate={currentDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            eventDates={activeDateSet}
          />
        )}
      </div>

      <div className="p-4 space-y-3">
        {activeTab === 'kampanya' && (
          <>
            {sortedEvents.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={28} />}
                title={isDateFiltered ? 'Bu günde kampanya yok' : 'Kampanya bulunamadı'}
                description={isDateFiltered
                  ? `${format(selectedDate!, 'd MMMM', { locale: tr })} tarihinde planlanmış kampanya bulunmuyor.`
                  : `${format(currentDate, 'MMMM yyyy', { locale: tr })} ayında henüz kampanya eklenmemiş.`}
                actionLabel={canAddCampaign ? 'Kampanya Ekle' : undefined}
                onAction={canAddCampaign ? onOpenAddCampaign : undefined}
              />
            ) : (
              sortedEvents.map((event) => (
                (() => {
                  const status = normalizeCampaignStatus(event.status);
                  const statusStyle = getStatusStyle(status);
                  return (
                    <button
                      key={event.id}
                      onClick={() => onOpenEvent(event.id)}
                      className="relative w-full text-left p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${statusStyle.stripeClass}`} />
                      <div className="pl-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{event.title}</p>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusStyle.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dotClass}`} />
                            {statusStyle.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(event.date, 'd MMM yyyy', { locale: tr })} • {userMap.get(event.assigneeId || '') || 'Atanmamış'}
                        </p>
                        <p className="text-[11px] mt-1 text-violet-600 dark:text-violet-300">
                          {event.campaignType || 'Yeni Kampanya'} • {URGENCY_CONFIGS[event.urgency]?.label || event.urgency}
                        </p>
                      </div>
                    </button>
                  );
                })()
              ))
            )}
          </>
        )}

        {activeTab === 'rapor' && (
          <>
            {sortedReports.length === 0 ? (
              <EmptyState
                icon={<FileText size={28} />}
                title={isDateFiltered ? 'Bu günde rapor yok' : 'Rapor bulunamadı'}
                description={isDateFiltered
                  ? `${format(selectedDate!, 'd MMMM', { locale: tr })} tarihinde teslim edilecek rapor bulunmuyor.`
                  : `${format(currentDate, 'MMMM yyyy', { locale: tr })} ayında rapor bulunmuyor.`}
              />
            ) : (
              sortedReports.map((report) => (
                (() => {
                  const status = normalizeReportStatus(report.status);
                  const statusStyle = getStatusStyle(status);
                  return (
                    <button
                      key={report.id}
                      onClick={() => onOpenReport(report.id)}
                      className="relative w-full text-left p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${statusStyle.stripeClass}`} />
                      <div className="pl-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{report.title}</p>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusStyle.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dotClass}`} />
                            {statusStyle.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Teslim: {format(report.dueDate, 'd MMM yyyy', { locale: tr })} • {userMap.get(report.assigneeId || '') || 'Atanmamış'}
                        </p>
                      </div>
                    </button>
                  );
                })()
              ))
            )}
          </>
        )}

        {activeTab === 'analitik' && (
          <>
            {sortedAnalyticsTasks.length === 0 ? (
              <EmptyState
                icon={<BarChart3 size={28} />}
                title={isDateFiltered ? 'Bu günde analitik iş yok' : 'Analitik iş bulunamadı'}
                description={isDateFiltered
                  ? `${format(selectedDate!, 'd MMMM', { locale: tr })} tarihinde analitik iş bulunmuyor.`
                  : `${format(currentDate, 'MMMM yyyy', { locale: tr })} ayında analitik iş bulunmuyor.`}
                actionLabel={canAddAnalytics ? 'Analitik İş Ekle' : undefined}
                onAction={canAddAnalytics ? onOpenAddAnalytics : undefined}
              />
            ) : (
              sortedAnalyticsTasks.map((task) => (
                (() => {
                  const status = normalizeCampaignStatus(task.status);
                  const statusStyle = getStatusStyle(status);
                  return (
                    <button
                      key={task.id}
                      onClick={() => onOpenAnalyticsTask(task.id)}
                      className="relative w-full text-left p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${statusStyle.stripeClass}`} />
                      <div className="pl-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{task.title}</p>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusStyle.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dotClass}`} />
                            {statusStyle.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(task.date, 'd MMM yyyy', { locale: tr })} • {analyticsMap.get(task.assigneeId || '') || 'Atanmamış'}
                        </p>
                      </div>
                    </button>
                  );
                })()
              ))
            )}
          </>
        )}

        {activeTab === 'islerim' && (
          <EmptyState
            icon={<Inbox size={28} />}
            title="İşleriniz"
            description="Size atanmış kampanya, rapor ve analitik işleri tek listede görüntüleyin."
            actionLabel="İşlerimi Aç"
            onAction={onOpenMyTasks}
          />
        )}

        {activeTab === 'diger' && (
          <div className="py-8 px-2 space-y-3">
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center">Ek yönetim ekranları yakında eklenecek.</p>
          </div>
        )}
      </div>

      {(activeTab === 'kampanya' && canAddCampaign) && (
        <button
          onClick={onOpenAddCampaign}
          className="fixed right-4 bottom-20 z-40 rounded-full w-14 h-14 bg-violet-600 text-white shadow-lg flex items-center justify-center"
          title="Kampanya Ekle"
        >
          <Plus size={24} />
        </button>
      )}

      {(activeTab === 'analitik' && canAddAnalytics) && (
        <button
          onClick={onOpenAddAnalytics}
          className="fixed right-4 bottom-20 z-40 rounded-full w-14 h-14 bg-blue-600 text-white shadow-lg flex items-center justify-center"
          title="Analitik İş Ekle"
        >
          <Plus size={24} />
        </button>
      )}

      <MobileBottomNav
        activeTab={activeTab}
        onChangeTab={onChangeTab}
        canSeeKampanyaTab={canSeeKampanyaTab}
        canSeeReportTab={canSeeReportTab}
        canSeeAnalyticsTab={canSeeAnalyticsTab}
      />
    </div>
  );
};

export default MobileShell;
