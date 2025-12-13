import React from 'react';
import { X, CheckCircle, XCircle, Clock, Calendar, Building } from 'lucide-react';
import { WorkRequest, Department } from '../types';
import { URGENCY_CONFIGS } from '../constants';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface IncomingRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: WorkRequest[];
  departments: Department[];
  onAccept: (request: WorkRequest) => void;
  onReject: (request: WorkRequest) => void;
}

export const IncomingRequestsModal: React.FC<IncomingRequestsModalProps> = ({
  isOpen,
  onClose,
  requests,
  departments,
  onAccept,
  onReject
}) => {
  if (!isOpen) return null;

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const getDepartmentName = (id: string) => {
    return departments.find(d => d.id === id)?.name || 'Bilinmeyen Birim';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">İş Talepleri</h2>
            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">
              {pendingRequests.length}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                <Clock size={32} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Bekleyen talep yok</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Şu anda onay bekleyen iş talebi bulunmuyor.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => {
                const urgencyConfig = URGENCY_CONFIGS[request.urgency];
                return (
                  <div key={request.id} className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${urgencyConfig.colorBg} ${urgencyConfig.colorText}`}>
                            {urgencyConfig.label}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Calendar size={12} />
                            {format(request.targetDate instanceof Date ? request.targetDate : (request.targetDate as any).toDate(), 'd MMMM yyyy', { locale: tr })}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">{request.title}</h3>
                        <div className="flex items-center gap-1 mt-1 text-sm text-gray-600 dark:text-gray-300">
                          <Building size={14} className="text-gray-400" />
                          <span className="font-medium">{getDepartmentName(request.departmentId)}</span>
                        </div>
                        {request.description && (
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg border border-gray-100 dark:border-slate-600/50">
                            {request.description}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                          Oluşturulma: {format(request.createdAt instanceof Date ? request.createdAt : (request.createdAt as any).toDate(), 'dd.MM.yyyy HH:mm')}
                        </p>
                      </div>
                      
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => onAccept(request)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-400 rounded-lg font-medium text-sm transition-colors"
                          title="Kabul Et ve Kampanyaya Dönüştür"
                        >
                          <CheckCircle size={16} />
                          <span>Kabul Et</span>
                        </button>
                        <button
                          onClick={() => onReject(request)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 rounded-lg font-medium text-sm transition-colors"
                          title="Reddet"
                        >
                          <XCircle size={16} />
                          <span>Reddet</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
