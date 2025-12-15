import React, { useState, useMemo } from 'react';
import { X, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Search, Filter, History } from 'lucide-react';
import { CalendarEvent, CampaignStatus, EventHistoryItem } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

interface MyTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: CalendarEvent[];
  onUpdateStatus: (eventId: string, newStatus: CampaignStatus) => Promise<void>;
}

const STATUS_COLORS: Record<CampaignStatus, string> = {
  'Planlandı': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Tamamlandı': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'İptal Edildi': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
};

export const MyTasksModal: React.FC<MyTasksModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onUpdateStatus
}) => {
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'updated'>('updated');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Filter by status
    if (filterStatus !== 'All') {
      result = result.filter(t => t.status === filterStatus);
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        (t.description || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'date') {
        // Sort by target date (ascending - closest deadline first)
        const dateA = a.date instanceof Date ? a.date : (a.date as any).toDate();
        const dateB = b.date instanceof Date ? b.date : (b.date as any).toDate();
        return dateA.getTime() - dateB.getTime();
      } else {
        // Sort by updated (descending - most recently updated first)
        // Fallback to createdAt or date if updatedAt missing
        const getTime = (ev: CalendarEvent) => {
          if (ev.updatedAt) return (ev.updatedAt instanceof Date ? ev.updatedAt : (ev.updatedAt as any).toDate()).getTime();
          if (ev.createdAt) return (ev.createdAt instanceof Date ? ev.createdAt : (ev.createdAt as any).toDate()).getTime();
          return (ev.date instanceof Date ? ev.date : (ev.date as any).toDate()).getTime();
        };
        return getTime(b) - getTime(a);
      }
    });

    return result;
  }, [tasks, filterStatus, searchQuery, sortBy]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100 dark:border-slate-800">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-lg">
              <CheckCircle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">İşlerim</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Size atanan kampanyalar ve görevler ({filteredTasks.length})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="İş ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-gray-900 dark:text-white text-sm"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {(['All', 'Planlandı', 'Tamamlandı', 'İptal Edildi'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  filterStatus === status 
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-200 dark:shadow-none' 
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                {status === 'All' ? 'Tümü' : status}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border-none rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
          >
            <option value="updated">Son Güncelleme</option>
            <option value="date">Hedef Tarih</option>
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30 dark:bg-slate-900/50">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} className="opacity-50" />
              </div>
              <p>Görev bulunamadı.</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const taskDate = task.date instanceof Date ? task.date : (task.date as any).toDate();
              const isOverdue = taskDate < new Date() && task.status === 'Planlandı';
              
              return (
                <div key={task.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group">
                  {/* Status Indicator Stripe */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    task.status === 'Tamamlandı' ? 'bg-green-500' : 
                    task.status === 'İptal Edildi' ? 'bg-red-500' : 
                    isOverdue ? 'bg-orange-500' : 'bg-blue-500'
                  }`} />

                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pl-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_COLORS[task.status || 'Planlandı']}`}>
                          {task.status}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1">
                            <AlertCircle size={10} /> Gecikmiş
                          </span>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <Calendar size={12} />
                          {format(taskDate, 'd MMMM yyyy', { locale: tr })}
                        </span>
                      </div>
                      
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">{task.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
                        {task.description || 'Açıklama yok.'}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                        {task.createdAt && (
                          <span title="Oluşturulma Tarihi">
                            Oluşturuldu: {format(task.createdAt instanceof Date ? task.createdAt : (task.createdAt as any).toDate(), 'd MMM', { locale: tr })}
                          </span>
                        )}
                        {task.updatedAt && (
                          <span title="Son Güncelleme" className="flex items-center gap-1">
                            <Clock size={12} />
                            Güncellendi: {format(task.updatedAt instanceof Date ? task.updatedAt : (task.updatedAt as any).toDate(), 'd MMM HH:mm', { locale: tr })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {task.status !== 'Tamamlandı' && (
                        <button
                          onClick={() => onUpdateStatus(task.id, 'Tamamlandı')}
                          className="px-3 py-1.5 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 justify-center"
                        >
                          <CheckCircle size={14} /> Tamamla
                        </button>
                      )}
                      
                      {task.status !== 'İptal Edildi' && (
                        <button
                          onClick={() => onUpdateStatus(task.id, 'İptal Edildi')}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 justify-center"
                        >
                          <XCircle size={14} /> İptal Et
                        </button>
                      )}

                      {task.status !== 'Planlandı' && (
                        <button
                          onClick={() => onUpdateStatus(task.id, 'Planlandı')}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 justify-center"
                        >
                          <Clock size={14} /> Tekrar Planla
                        </button>
                      )}
                    </div>
                  </div>

                  {/* History Toggle */}
                  {task.history && task.history.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 pl-3">
                      <button 
                        onClick={() => setExpandedHistoryId(expandedHistoryId === task.id ? null : task.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
                      >
                        <History size={12} />
                        {expandedHistoryId === task.id ? 'Geçmişi Gizle' : 'Geçmişi Göster'}
                      </button>
                      
                      {expandedHistoryId === task.id && (
                        <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-100 dark:border-slate-700">
                          {task.history.sort((a,b) => (b.date instanceof Date ? b.date : (b.date as any).toDate()).getTime() - (a.date instanceof Date ? a.date : (a.date as any).toDate()).getTime()).map((h, idx) => (
                            <div key={idx} className="text-xs">
                              <span className="text-gray-500 dark:text-gray-400">
                                {format(h.date instanceof Date ? h.date : (h.date as any).toDate(), 'd MMM HH:mm', { locale: tr })}
                              </span>
                              <span className="mx-2 text-gray-300">|</span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {h.action === 'status_changed' ? (
                                  <>Durum: <b>{h.oldStatus}</b> → <b>{h.newStatus}</b></>
                                ) : h.action === 'created' ? (
                                  'Oluşturuldu'
                                ) : (
                                  h.action
                                )}
                              </span>
                              {h.changedBy && <span className="text-gray-400 ml-1">({h.changedBy})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
