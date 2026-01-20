import React, { useState, useMemo } from 'react';
import { X, Calendar, Clock, User, CheckCircle2, AlertCircle, Timer, Filter, ArrowUpDown } from 'lucide-react';
import { CalendarEvent, User as UserType, CampaignStatus, Department } from '../types';
import { format, differenceInHours, differenceInDays, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

interface DesignerCampaignsModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  users: UserType[];
  departments: Department[];
}

type SortField = 'date' | 'createdAt' | 'duration';
type SortDirection = 'asc' | 'desc';

export const DesignerCampaignsModal: React.FC<DesignerCampaignsModalProps> = ({
  isOpen,
  onClose,
  events,
  users,
  departments
}) => {
  const [activeTab, setActiveTab] = useState<CampaignStatus>('Planlandı');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');

  if (!isOpen) return null;

  // Helper to format duration - counts from the first assigned date on calendar
  const calculateDuration = (event: CalendarEvent): string => {
    // Use originalDate if available, otherwise use date (for legacy events)
    const startDate = event.originalDate || event.date;

    if (!startDate || !isValid(startDate)) return '-';

    // For future-dated events that haven't started yet
    const now = new Date();
    if (startDate > now && event.status === 'Planlandı') {
      return 'Henüz başlamadı';
    }

    let endDate: Date | null = null;

    if (event.status === 'Planlandı') {
      // For active campaigns, count from startDate to now (but only if startDate has passed)
      endDate = now;
    } else {
      // Find the status change event in history
      if (event.history && event.history.length > 0) {
        // Look for the last status change that matches current status
        const statusChange = [...event.history].reverse().find(
          h => h.newStatus === event.status
        );
        if (statusChange && statusChange.date && isValid(statusChange.date)) {
          endDate = statusChange.date;
        }
      }

      // Fallback to updatedAt if history missing (legacy support)
      if (!endDate && event.updatedAt && isValid(event.updatedAt)) {
        endDate = event.updatedAt;
      }
    }

    if (!endDate || !isValid(endDate)) return '-';

    try {
      const totalHours = differenceInHours(endDate, startDate);
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;

      if (event.status === 'Planlandı') {
        return `${days}g ${hours}s (Geçen)`;
      }

      return `${days}g ${hours}s`;
    } catch (error) {
      console.error("Duration calculation error:", error);
      return '-';
    }
  };

  const getAssigneeName = (id?: string) => {
    if (!id) return 'Atanmamış';
    const user = users.find(u => u.id === id);
    return user?.name || 'Bilinmiyor';
  };

  const filteredAndSortedEvents = useMemo(() => {
    let result = events.filter(e => {
      const matchesTab = (e.status || 'Planlandı') === activeTab;
      const eventTitle = e.title || '';
      const assigneeName = getAssigneeName(e.assigneeId);

      const matchesSearch = eventTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assigneeName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDepartment = filterDepartment ? e.departmentId === filterDepartment : true;

      return matchesTab && matchesSearch && matchesDepartment;
    });

    return result.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortField) {
        case 'date':
          valA = (a.date && isValid(a.date)) ? a.date : new Date(0);
          valB = (b.date && isValid(b.date)) ? b.date : new Date(0);
          break;
        case 'createdAt':
          valA = (a.createdAt && isValid(a.createdAt)) ? a.createdAt : new Date(0);
          valB = (b.createdAt && isValid(b.createdAt)) ? b.createdAt : new Date(0);
          break;
        case 'duration':
          // Simplistic duration sort based on creation date for now as calculating all is expensive
          // Or we can memoize calculations. For now let's sort by createdAt as proxy or disable.
          // Actually, let's just sort by createdAt for duration proxy.
          valA = (a.createdAt && isValid(a.createdAt)) ? a.createdAt : new Date(0);
          valB = (b.createdAt && isValid(b.createdAt)) ? b.createdAt : new Date(0);
          break;
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });
  }, [events, activeTab, sortField, sortDirection, searchTerm, users, filterDepartment]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="opacity-30" />;
    return <ArrowUpDown size={14} className={sortDirection === 'asc' ? 'text-violet-600' : 'text-violet-600 transform rotate-180'} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden border border-gray-100 dark:border-slate-700">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="text-violet-600" />
              Kampanya Yönetim Modülü
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Tasarımcılar için detaylı süreç takibi ve performans metrikleri
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs & Filters */}
        <div className="px-6 py-4 bg-gray-50/50 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center shrink-0">
          <div className="flex bg-gray-200 dark:bg-slate-800 p-1 rounded-xl">
            {(['Planlandı', 'Bekleme', 'Tamamlandı', 'İptal Edildi'] as CampaignStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-semibold transition-all
                  ${activeTab === status
                    ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}
                `}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-48">
            <Filter className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all appearance-none"
            >
              <option value="">Tüm Birimler</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full md:w-64">
            <Filter className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Kampanya veya kişi ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
            />
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-slate-800/50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kampanya</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Atanan Kişi</th>
                <th
                  className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Takvim Tarihi <SortIcon field="date" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-1">
                    Atama Tarihi <SortIcon field="createdAt" />
                  </div>
                </th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {activeTab === 'Planlandı' ? 'Durum' : 'Tamamlanma/İptal Tarihi'}
                </th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <Timer size={14} /> Süre
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredAndSortedEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Bu kategoride kampanya bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredAndSortedEvents.map((event) => {
                  const createdDate = event.createdAt;
                  const calendarDate = event.date;

                  // Find status change date
                  let statusChangeDate: Date | null = null;
                  if (activeTab !== 'Planlandı' && event.history) {
                    const change = [...event.history].reverse().find(h => h.newStatus === activeTab);
                    if (change && change.date) {
                      statusChangeDate = change.date;
                    }
                  }

                  return (
                    <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">{event.title || 'İsimsiz Kampanya'}</div>
                        {event.description && (
                          <div className="text-xs text-gray-400 truncate max-w-[200px]">{event.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold">
                            {getAssigneeName(event.assigneeId).charAt(0)}
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{getAssigneeName(event.assigneeId)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Calendar size={14} />
                          {calendarDate && isValid(calendarDate) ? format(calendarDate, 'd MMMM yyyy', { locale: tr }) : 'Geçersiz Tarih'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-sm text-gray-600 dark:text-gray-400">
                          <span>{createdDate && isValid(createdDate) ? format(createdDate, 'd MMM yyyy', { locale: tr }) : '-'}</span>
                          <span className="text-xs text-gray-400">{createdDate && isValid(createdDate) ? format(createdDate, 'HH:mm') : ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {activeTab === 'Planlandı' ? (
                          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold dark:bg-blue-900/30 dark:text-blue-300">
                            Planlandı
                          </span>
                        ) : (
                          <div className="flex flex-col text-sm text-gray-600 dark:text-gray-400">
                            <span>{statusChangeDate && isValid(statusChangeDate) ? format(statusChangeDate, 'd MMM yyyy', { locale: tr }) : '-'}</span>
                            <span className="text-xs text-gray-400">{statusChangeDate && isValid(statusChangeDate) ? format(statusChangeDate, 'HH:mm') : ''}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300">
                          {calculateDuration(event)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 shrink-0 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
          <span>Toplam {filteredAndSortedEvents.length} kayıt listelendi.</span>
          <span>* Süre hesaplaması atama anından son durum değişikliğine kadar geçen süreyi baz alır.</span>
        </div>
      </div>
    </div>
  );
};
