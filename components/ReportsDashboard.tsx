import React, { useMemo, useState, useEffect } from 'react';
import { X, BarChart3, TrendingUp, Calendar, Users, PieChart, RefreshCw, Filter } from 'lucide-react';
import { CalendarEvent, Department, User } from '../types';
import {
  format,
  startOfYear,
  endOfYear,
  startOfMonth,
  subMonths,
  subDays,
  isWithinInterval,
  parseISO,
  endOfDay,
  startOfDay,
  subYears
} from 'date-fns';
import { tr } from 'date-fns/locale';

interface ReportsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  departments: Department[];
  users: User[];
  onRefresh?: () => Promise<void> | void;
  monthlyChampionIds?: string[];
}

type DateRangePreset = 'thisYear' | 'lastYear' | 'thisMonth' | 'last3Months' | 'last30Days' | 'custom';

export function ReportsDashboard({ isOpen, onClose, events, departments, users, onRefresh, monthlyChampionIds = [] }: ReportsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'departments' | 'users'>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Date Filter State
  const [preset, setPreset] = useState<DateRangePreset>('thisYear');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfYear(new Date()),
    end: new Date()
  });

  // URL Persistence
  useEffect(() => {
    if (!isOpen) return;

    const params = new URLSearchParams(window.location.search);
    const pPreset = params.get('preset') as DateRangePreset;
    const pStart = params.get('start');
    const pEnd = params.get('end');

    if (pPreset && pPreset !== preset) {
      setPreset(pPreset);
      if (pPreset === 'custom' && pStart && pEnd) {
        setCustomStart(pStart);
        setCustomEnd(pEnd);
        setDateRange({ start: parseISO(pStart), end: parseISO(pEnd) });
      } else {
        applyPreset(pPreset);
      }
    }
  }, [isOpen]);

  const updateUrl = (newPreset: DateRangePreset, start?: Date, end?: Date) => {
    const params = new URLSearchParams(window.location.search);
    params.set('preset', newPreset);

    if (newPreset === 'custom' && start && end) {
      params.set('start', format(start, 'yyyy-MM-dd'));
      params.set('end', format(end, 'yyyy-MM-dd'));
    } else {
      params.delete('start');
      params.delete('end');
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const applyPreset = (p: DateRangePreset) => {
    const now = new Date();
    let start = now;
    let end = now;

    switch (p) {
      case 'thisYear':
        start = startOfYear(now);
        break;
      case 'lastYear':
        start = startOfYear(subYears(now, 1));
        end = endOfYear(subYears(now, 1));
        break;
      case 'thisMonth':
        start = startOfMonth(now);
        break;
      case 'last3Months':
        start = subMonths(now, 3);
        break;
      case 'last30Days':
        start = subDays(now, 30);
        break;
      case 'custom':
        return; // Handled separately
    }

    setDateRange({ start, end });
    setPreset(p);
    updateUrl(p);
  };

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') setCustomStart(value);
    else setCustomEnd(value);

    if (type === 'start' && customEnd && value > customEnd) {
      // If start is after end, clear end or warn? For now, just let user fix it.
    }

    const s = type === 'start' ? value : customStart;
    const e = type === 'end' ? value : customEnd;

    if (s && e) {
      const dStart = parseISO(s);
      const dEnd = parseISO(e);

      if (dStart <= dEnd) {
        setDateRange({ start: dStart, end: dEnd });
        updateUrl('custom', dStart, dEnd);
      }
    }
  };

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      // Small delay to show animation
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      // Avoid interfering with input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 't': // This Year
          applyPreset('thisYear');
          break;
        case 'y': // Last Year (Yıl)
          applyPreset('lastYear');
          break;
        case 'm': // This Month (Month)
          applyPreset('thisMonth');
          break;
        case '3': // Last 3 Months
          applyPreset('last3Months');
          break;
        case 'd': // Last 30 Days (Days)
          applyPreset('last30Days');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // --- Data Processing ---
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Exclude Cancelled events
      if (event.status === 'İptal Edildi') return;

      // Date Filter
      // We compare dates at the day level to avoid time issues
      const eventDate = startOfDay(event.date);
      const start = startOfDay(dateRange.start);
      const end = endOfDay(dateRange.end);

      return isWithinInterval(eventDate, { start, end });
    });
  }, [events, dateRange]);

  const stats = useMemo(() => {
    // Initialize counters
    const deptStats: Record<string, { name: string; active: number; completed: number }> = {};
    const userStats: Record<string, { name: string; active: number; completed: number; role: string }> = {};
    // Monthly activity needs to be dynamic based on range, but for simplicity we'll keep 12 months bucket
    // If range > 1 year, this chart might be weird, but usually dashboards show "Current View" months
    const monthlyActivity = new Array(12).fill(0);

    // Fill initial maps
    departments.forEach(d => {
      deptStats[d.id] = { name: d.name, active: 0, completed: 0 };
    });
    users.forEach(u => {
      userStats[u.id] = { name: u.name, active: 0, completed: 0, role: u.role };
    });

    let totalPeriod = 0;
    let completedPeriod = 0;

    filteredEvents.forEach(event => {
      const date = new Date(event.date);
      const month = date.getMonth();
      const isCompleted = event.status === 'Tamamlandı';

      totalPeriod++;
      if (isCompleted) completedPeriod++;

      // Only fill monthly chart if it falls in the standard Jan-Dec view
      // Or we could map it to relative months?
      // Let's stick to 0-11 index for the "Year View". 
      // If "Last 30 Days" spans 2 months, it will show up in those 2 months.
      if (date.getFullYear() === new Date().getFullYear()) { // Show monthly breakdown only for current year events to avoid confusion?
        // Or just show all? If I show all, indices 0-11 wrap around.
        // Let's just map to 0-11 for simplicity, assuming mostly current year analysis.
        monthlyActivity[month]++;
      } else if (preset === 'lastYear' && date.getFullYear() === new Date().getFullYear() - 1) {
        monthlyActivity[month]++;
      }

      // Department Stats
      if (deptStats[event.departmentId]) {
        if (isCompleted) {
          deptStats[event.departmentId].completed++;
        } else {
          deptStats[event.departmentId].active++;
        }
      }

      // User Stats
      if (event.assigneeId && userStats[event.assigneeId]) {
        if (isCompleted) {
          userStats[event.assigneeId].completed++;
        } else {
          userStats[event.assigneeId].active++;
        }
      }
    });

    // Sort for charts (Active + Completed)
    const sortedDeptByTotal = Object.values(deptStats).sort((a, b) => (b.active + b.completed) - (a.active + a.completed));
    const sortedUsersByTotal = Object.values(userStats)
      // .filter(u => u.role === 'kampanya') // Role filtering disabled until database update
      .sort((a, b) => (b.active + b.completed) - (a.active + a.completed));

    return {
      deptStats,
      userStats,
      monthlyActivity,
      sortedDeptByTotal,
      sortedUsersByTotal,
      totalPeriod,
      completedPeriod
    };
  }, [filteredEvents, departments, users, preset]);

  if (!isOpen) return null;

  // --- Helper Components ---

  const SimpleBar = ({ label, value, max, color = "bg-violet-500", subValue }: { label: string, value: number, max: number, color?: string, subValue?: string }) => (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-32 text-sm font-medium text-gray-600 dark:text-gray-300 truncate text-right" title={label}>
        {label}
      </div>
      <div className="flex-1 h-8 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden relative">
        <div
          className={`h-full ${color} transition-all duration-500 flex items-center px-2`}
          style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
        >
          {value > 0 && <span className="text-xs font-bold text-white drop-shadow-md">{value}</span>}
        </div>
        {value === 0 && <span className="absolute inset-0 flex items-center pl-2 text-xs text-gray-400">0</span>}
      </div>
      {subValue && <div className="w-16 text-xs text-gray-400 text-right">{subValue}</div>}
    </div>
  );

  const MonthChart = () => {
    const maxVal = Math.max(...stats.monthlyActivity);
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

    return (
      <div className="h-64 flex items-end justify-between gap-1 mt-4 px-2">
        {stats.monthlyActivity.map((count, index) => (
          <div key={index} className="flex flex-col items-center flex-1 group relative">
            <div className="relative w-full flex justify-center items-end h-48 bg-gray-50 dark:bg-slate-800/50 rounded-t-lg">
              <div
                className="w-4/5 bg-violet-500 dark:bg-violet-600 rounded-t-md transition-all duration-500 hover:bg-violet-400 relative group-hover:shadow-lg"
                style={{ height: `${maxVal > 0 ? (count / maxVal) * 100 : 0}%` }}
              >
                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded shadow transition-opacity z-10">
                  {count} Kampanya
                </div>
              </div>
            </div>
            <div className="mt-2 text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium -rotate-45 md:rotate-0 origin-top-left md:origin-center translate-y-2 md:translate-y-0">
              {months[index].substring(0, 3)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <PieChart className="text-violet-600" />
              Kampanya Raporları & Dashboard
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {new Date().getFullYear()} yılı performans özeti ve istatistikler
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={handleRefresh}
                className={`p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500 dark:text-gray-400 ${isRefreshing ? 'animate-spin text-violet-600' : ''}`}
                title="Verileri Yenile"
                disabled={isRefreshing}
              >
                <RefreshCw size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500 dark:text-gray-400"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-col bg-white dark:bg-slate-800">

          {/* Date Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-800/30">
            <div className="flex items-center gap-2 mr-4 text-gray-500 dark:text-gray-400">
              <Filter size={18} />
              <span className="text-sm font-medium">Tarih Aralığı:</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => applyPreset('thisYear')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${preset === 'thisYear' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50'}`}>Bu Yıl</button>
              <button onClick={() => applyPreset('lastYear')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${preset === 'lastYear' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50'}`}>Geçen Yıl</button>
              <button onClick={() => applyPreset('thisMonth')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${preset === 'thisMonth' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50'}`}>Bu Ay</button>
              <button onClick={() => applyPreset('last3Months')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${preset === 'last3Months' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50'}`}>Son 3 Ay</button>
              <button onClick={() => applyPreset('last30Days')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${preset === 'last30Days' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50'}`}>Son 30 Gün</button>
            </div>

            <div className="h-6 w-px bg-gray-300 dark:bg-slate-600 mx-2 hidden md:block"></div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart || (preset !== 'custom' ? format(dateRange.start, 'yyyy-MM-dd') : '')}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => handleCustomDateChange('start', e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={customEnd || (preset !== 'custom' ? format(dateRange.end, 'yyyy-MM-dd') : '')}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => handleCustomDateChange('end', e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
              />
            </div>
          </div>

          <div className="flex border-b border-gray-100 dark:border-slate-700 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'overview' ? 'border-violet-600 text-violet-600 dark:text-violet-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
            >
              <TrendingUp size={16} />
              Genel Bakış & Zaman
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'departments' ? 'border-violet-600 text-violet-600 dark:text-violet-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
            >
              <BarChart3 size={16} />
              Birim Performansı
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'users' ? 'border-violet-600 text-violet-600 dark:text-violet-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
            >
              <Users size={16} />
              Personel Performansı
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-slate-900/30">

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1">
                      {preset === 'thisMonth' ? 'Bu Ay' : 'Seçili Dönem'} Yapılan Kampanya
                    </div>
                    <div className="text-4xl font-black text-violet-600 dark:text-violet-400">{stats.totalPeriod}</div>
                    <div className="text-xs text-gray-400 mt-2">
                      {format(dateRange.start, 'd MMM yyyy', { locale: tr })} - {format(dateRange.end, 'd MMM yyyy', { locale: tr })}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1">
                      {preset === 'thisMonth' ? 'Bu Ay' : 'Seçili Dönem'} Tamamlanan
                    </div>
                    <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{stats.completedPeriod}</div>
                    <div className="text-xs text-gray-400 mt-2">
                      Toplam {stats.totalPeriod} kampanyadan
                    </div>
                  </div>
                </div>

                {/* Monthly Chart */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar className="text-gray-400" size={20} />
                    Aylık Kampanya Dağılımı (En Yoğun Aylar)
                  </h3>
                  <MonthChart />
                </div>
              </div>
            )}

            {/* DEPARTMENTS TAB */}
            {activeTab === 'departments' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Tüm Kampanyalar (Devam Eden + Tamamlanan)</h3>
                  <div className="space-y-1">
                    {stats.sortedDeptByTotal.map(d => (
                      <SimpleBar
                        key={d.name}
                        label={d.name}
                        value={d.active + d.completed}
                        max={Math.max(...stats.sortedDeptByTotal.map(x => x.active + x.completed))}
                        color="bg-blue-500"
                        subValue={`${d.completed} Tamamlandı`}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Sadece Tamamlananlar</h3>
                  <div className="space-y-1">
                    {stats.sortedDeptByTotal.map(d => (
                      <SimpleBar
                        key={d.name}
                        label={d.name}
                        value={d.completed}
                        max={Math.max(...stats.sortedDeptByTotal.map(x => x.completed), 1)}
                        color="bg-emerald-500"
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Tüm Kampanyalar (Devam Eden + Tamamlanan)</h3>
                  <p className="text-xs text-gray-400 mb-4">* Sadece 'Kampanya Yapan' rolündeki kullanıcılar listelenir.</p>
                  <div className="space-y-1">
                    {stats.sortedUsersByTotal.map(u => (
                      <SimpleBar
                        key={u.name}
                        label={`${u.name} ${monthlyChampionIds.includes(users.find(user => user.name === u.name)?.id || '') ? '🏆' : ''}`}
                        value={u.active + u.completed}
                        max={Math.max(...stats.sortedUsersByTotal.map(x => x.active + x.completed))}
                        color="bg-indigo-500"
                        subValue={`${u.completed} Tamamlandı`}
                      />
                    ))}
                    {stats.sortedUsersByTotal.length === 0 && (
                      <p className="text-center text-gray-400 py-4">Veri bulunamadı.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Sadece Tamamlananlar</h3>
                  <p className="text-xs text-gray-400 mb-4">* Sadece 'Kampanya Yapan' rolündeki kullanıcılar listelenir.</p>
                  <div className="space-y-1">
                    {stats.sortedUsersByTotal.map(u => (
                      <SimpleBar
                        key={u.name}
                        label={`${u.name} ${monthlyChampionIds.includes(users.find(user => user.name === u.name)?.id || '') ? '🏆' : ''}`}
                        value={u.completed}
                        max={Math.max(...stats.sortedUsersByTotal.map(x => x.completed), 1)}
                        color="bg-teal-500"
                      />
                    ))}
                    {stats.sortedUsersByTotal.length === 0 && (
                      <p className="text-center text-gray-400 py-4">Veri bulunamadı.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
