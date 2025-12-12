import React, { useMemo, useState } from 'react';
import { X, BarChart3, TrendingUp, Calendar, Users, PieChart, Download, RefreshCw } from 'lucide-react';
import { CalendarEvent, Department, User } from '../types';
import { format, isSameMonth, isSameYear, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { tr } from 'date-fns/locale';

interface ReportsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  departments: Department[];
  users: User[];
  onRefresh?: () => void;
}

export function ReportsDashboard({ isOpen, onClose, events, departments, users, onRefresh }: ReportsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'departments' | 'users'>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      // Small delay to show animation
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  // --- Data Processing ---
  const stats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Initialize counters
    const deptStats: Record<string, { name: string; active: number; completed: number }> = {};
    const userStats: Record<string, { name: string; active: number; completed: number; role: string }> = {};
    const monthlyActivity = new Array(12).fill(0);
    
    // Fill initial maps
    departments.forEach(d => {
      deptStats[d.id] = { name: d.name, active: 0, completed: 0 };
    });
    users.forEach(u => {
      userStats[u.id] = { name: u.name, active: 0, completed: 0, role: u.role };
    });

    let totalYear = 0;
    let totalMonth = 0;

    events.forEach(event => {
      // Exclude Cancelled events
      if (event.status === 'İptal Edildi') return;

      const date = new Date(event.date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const isCompleted = event.status === 'Tamamlandı';

      if (year === currentYear) {
        totalYear++;
        monthlyActivity[month]++;
        
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

        if (month === currentMonth) {
          totalMonth++;
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
      totalYear,
      totalMonth
    };
  }, [events, departments, users]);

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
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1">Bu Ay Yapılan Kampanya</div>
                  <div className="text-4xl font-black text-violet-600 dark:text-violet-400">{stats.totalMonth}</div>
                  <div className="text-xs text-gray-400 mt-2">
                    {format(new Date(), 'MMMM yyyy', { locale: tr })}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1">Yılbaşından Bugüne</div>
                  <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{stats.totalYear}</div>
                  <div className="text-xs text-gray-400 mt-2">
                    2024 Toplam
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
                      label={u.name} 
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
                      label={u.name} 
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
  );
}
