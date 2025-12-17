
import React, { useState, useMemo } from 'react';
import { X, Calendar, User, Clock, CheckCircle2, Search, ArrowUpDown, Timer } from 'lucide-react';
import { CalendarEvent, User as UserType, CampaignStatus } from '../types';
import { format, differenceInHours, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

interface CampaignMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  users: UserType[];
}

type SortField = 'date' | 'assignmentDate' | 'duration' | 'completionDate';
type SortDirection = 'asc' | 'desc';

export const CampaignMonitoringModal: React.FC<CampaignMonitoringModalProps> = ({
  isOpen,
  onClose,
  events,
  users
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('assignmentDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  if (!isOpen) return null;

  // Helper to find assignment date from history
  const getAssignmentDate = (event: CalendarEvent): Date | null => {
     // If we have history, look for the first assignment or creation
     // Assuming creation is the initial assignment if history is scarce,
     // or look for 'assigneeId' change if we tracked it (but history usually only tracks status/general changes unless specialized)
     // The prompt says "assigned date". createdAt is often the best proxy if distinct assignment event isn't logged.
     // However, let's look at history if 'action' contains assignment info?
     // Existing EventHistoryItem: { date, action, oldStatus, newStatus, changedBy }
     // The app might not log strict "assigned to X" events in history yet.
     // Fallback: createdAt.
     return event.createdAt && isValid(new Date(event.createdAt)) ? new Date(event.createdAt) : null;
  };

  // Helper to find completion date
  const getCompletionDate = (event: CalendarEvent): Date | null => {
     if (event.status !== 'Tamamlandı') return null;
     
     // Look in history for change to 'Tamamlandı'
     if (event.history && event.history.length > 0) {
         const doneEvent = [...event.history].reverse().find(h => h.newStatus === 'Tamamlandı');
         if (doneEvent && doneEvent.date) return new Date(doneEvent.date);
     }
     
     // Fallback: If no history but status is completed, maybe updatedAt?
     return event.updatedAt ? new Date(event.updatedAt) : null;
  };

  // Helper to calculate duration
  const calculateDuration = (event: CalendarEvent): { text: string; hours: number } => {
    const start = getAssignmentDate(event);
    const end = getCompletionDate(event);

    if (!start || !end || !isValid(start) || !isValid(end)) {
        return { text: '-', hours: -1 };
    }

    const totalHours = differenceInHours(end, start);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    
    return { 
        text: `${days}g ${hours}s`,
        hours: totalHours
    };
  };
  
  const getAssigneeName = (id?: string) => {
    if (!id) return 'Atanmamış';
    const user = users.find(u => u.id === id);
    return user?.name || 'Bilinmiyor';
  };

  const processedEvents = useMemo(() => {
    return events.map(event => {
        const assignmentDate = getAssignmentDate(event);
        const completionDate = getCompletionDate(event);
        const duration = calculateDuration(event);
        const assigneeName = getAssigneeName(event.assigneeId);
        
        return {
            ...event,
            assignmentDate,
            completionDate,
            duration,
            assigneeName
        };
    }).filter(e => {
        // Search filter
        const lowerSearch = searchTerm.toLowerCase();
        return (
            e.title.toLowerCase().includes(lowerSearch) ||
            e.assigneeName.toLowerCase().includes(lowerSearch)
        );
    }).sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        switch (sortField) {
            case 'date':
                 // This is Calendar Date
                 valA = a.date ? new Date(a.date).getTime() : 0;
                 valB = b.date ? new Date(b.date).getTime() : 0;
                 break;
            case 'assignmentDate':
                 valA = a.assignmentDate ? a.assignmentDate.getTime() : 0;
                 valB = b.assignmentDate ? b.assignmentDate.getTime() : 0;
                 break;
            case 'completionDate':
                 valA = a.completionDate ? a.completionDate.getTime() : 0;
                 valB = b.completionDate ? b.completionDate.getTime() : 0;
                 break;
            case 'duration':
                 valA = a.duration.hours;
                 valB = b.duration.hours;
                 break;
        }

        return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [events, users, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="opacity-30 ml-1" />;
    return <ArrowUpDown size={14} className={`ml-1 ${sortDirection === 'asc' ? 'text-violet-600' : 'text-violet-600 transform rotate-180'}`} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-7xl h-[85vh] flex flex-col overflow-hidden border border-gray-100 dark:border-slate-700">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Timer className="text-violet-600" />
              Kampanya İzleme Modülü
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Atanan görevlendirmeler, süreler ve durum takibi
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
          >
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 bg-gray-50/50 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center shrink-0">
             <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Kampanya veya kişi ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                />
             </div>
             <div className="text-sm text-gray-500">
                Toplam Kayıt: <strong>{processedEvents.length}</strong>
             </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <tr>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kampanya</th>
                        <th 
                            className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800"
                            onClick={() => handleSort('assignmentDate')}
                        >
                            <div className="flex items-center">
                                Atama Tarihi <SortIcon field="assignmentDate" />
                            </div>
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Atanan Kişi</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Durum</th>
                        <th 
                            className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800"
                            onClick={() => handleSort('completionDate')}
                        >
                            <div className="flex items-center">
                                Bitiş Tarihi <SortIcon field="completionDate" />
                            </div>
                        </th>
                         <th 
                            className="px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800"
                            onClick={() => handleSort('duration')}
                        >
                            <div className="flex items-center">
                                Süre (Gün/Saat) <SortIcon field="duration" />
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {processedEvents.length === 0 ? (
                         <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                Kayıt bulunamadı.
                            </td>
                         </tr>
                    ) : (
                        processedEvents.map(event => (
                            <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-gray-900 dark:text-white">{event.title}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                    {event.assignmentDate ? format(event.assignmentDate, 'd MMM yyyy HH:mm', { locale: tr }) : '-'}
                                </td>
                                <td className="px-6 py-4">
                                     <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                            {event.assigneeName.charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{event.assigneeName}</span>
                                     </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`
                                        px-2.5 py-1 rounded-full text-xs font-bold border
                                        ${event.status === 'Tamamlandı' 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30' 
                                            : event.status === 'İptal Edildi'
                                                ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30'
                                                : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30'}
                                    `}>
                                        {event.status || 'Planlandı'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                     {event.completionDate ? format(event.completionDate, 'd MMM yyyy HH:mm', { locale: tr }) : '-'}
                                </td>
                                <td className="px-6 py-4 text-sm font-mono text-gray-700 dark:text-gray-300">
                                     {event.duration.text}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

      </div>
    </div>
  );
};
