import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarEvent, Report, AnalyticsTask, User, AnalyticsUser } from '../../types';
import { Plus, ChevronLeft, ChevronRight, LogIn, UserPlus } from 'lucide-react';
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

const getCampaignStatusBadgeClass = (status?: string) => {
  switch (status) {
    case 'Tamamlandı':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'Planlandı':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'Bekleme':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'İptal Edildi':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300';
  }
};

const getCampaignCardAccentClass = (status?: string) => {
  switch (status) {
    case 'Tamamlandı':
      return 'border-l-4 border-l-emerald-500';
    case 'Planlandı':
      return 'border-l-4 border-l-yellow-500';
    case 'Bekleme':
      return 'border-l-4 border-l-amber-500';
    case 'İptal Edildi':
      return 'border-l-4 border-l-red-500';
    default:
      return 'border-l-4 border-l-gray-300 dark:border-l-slate-600';
  }
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

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aStatus = a.status || 'Planlandı';
      const bStatus = b.status || 'Planlandı';
      const aRank = aStatus === 'Planlandı' ? 0 : 1;
      const bRank = bStatus === 'Planlandı' ? 0 : 1;

      if (aRank !== bRank) return aRank - bRank;
      return a.date.getTime() - b.date.getTime();
    });
  }, [events]);
  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    [reports]
  );
  const sortedAnalyticsTasks = useMemo(
    () => [...analyticsTasks].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [analyticsTasks]
  );

  return (
    <div className="min-h-screen bg-[#F8F9FE] dark:bg-slate-900 text-gray-900 dark:text-gray-100 pb-20">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-gray-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold">Kampanya-Analitik Takvim (Mobil)</h1>
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
          <button onClick={onPrevPeriod} className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800">
            <ChevronLeft size={16} />
          </button>
          <button onClick={onResetToToday} className="text-sm font-semibold">
            {format(currentDate, 'MMMM yyyy', { locale: tr })}
          </button>
          <button onClick={onNextPeriod} className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {activeTab === 'kampanya' && (
          <>
            {sortedEvents.length === 0 ? (
              <p className="text-sm text-gray-500">Bu filtrede kampanya bulunamadı.</p>
            ) : (
              sortedEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onOpenEvent(event.id)}
                  className={`w-full text-left p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${getCampaignCardAccentClass(event.status || 'Planlandı')}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">{event.title}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${getCampaignStatusBadgeClass(event.status || 'Planlandı')}`}>
                      {event.status || 'Planlandı'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {format(event.date, 'd MMM yyyy', { locale: tr })} • {userMap.get(event.assigneeId || '') || 'Atanmamış'}
                  </p>
                  <p className="text-[11px] mt-1 text-violet-600 dark:text-violet-300">
                    {event.campaignType || 'Yeni Kampanya'} • {URGENCY_CONFIGS[event.urgency]?.label || event.urgency}
                  </p>
                </button>
              ))
            )}
          </>
        )}

        {activeTab === 'rapor' && (
          <>
            {sortedReports.length === 0 ? (
              <p className="text-sm text-gray-500">Rapor bulunamadı.</p>
            ) : (
              sortedReports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => onOpenReport(report.id)}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">{report.title}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {report.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Teslim: {format(report.dueDate, 'd MMM yyyy', { locale: tr })} • {userMap.get(report.assigneeId || '') || 'Atanmamış'}
                  </p>
                </button>
              ))
            )}
          </>
        )}

        {activeTab === 'analitik' && (
          <>
            {sortedAnalyticsTasks.length === 0 ? (
              <p className="text-sm text-gray-500">Analitik iş bulunamadı.</p>
            ) : (
              sortedAnalyticsTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onOpenAnalyticsTask(task.id)}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">{task.title}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {task.status || 'Planlandı'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {format(task.date, 'd MMM yyyy', { locale: tr })} • {analyticsMap.get(task.assigneeId || '') || 'Atanmamış'}
                  </p>
                </button>
              ))
            )}
          </>
        )}

        {activeTab === 'islerim' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">Size atanmış işleri tek listede görmek için açın.</p>
            <button
              onClick={onOpenMyTasks}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-600 text-white font-medium"
            >
              <UserPlus size={16} />
              İşlerimi Aç
            </button>
          </div>
        )}

        {activeTab === 'diger' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">Faz 1 mobil kabuk aktif. Ek yönetim ekranları Faz 2 ile genişletilecek.</p>
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
