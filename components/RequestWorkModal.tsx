import React, { useState, useEffect } from 'react';
import { X, AlertCircle, AlignLeft, Calendar } from 'lucide-react';
import { UrgencyLevel } from '../types';
import { URGENCY_CONFIGS, TURKISH_HOLIDAYS } from '../constants';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface RequestWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequest: (title: string, urgency: UrgencyLevel, date: Date, description?: string, requesterEmail?: string) => void;
  initialDate?: Date;
  defaultEmail?: string;
}

export const RequestWorkModal: React.FC<RequestWorkModalProps> = ({ isOpen, onClose, onRequest, initialDate, defaultEmail }) => {
  const [title, setTitle] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('Medium');
  const [dateStr, setDateStr] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [holidayWarning, setHolidayWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialDate) {
      const year = initialDate.getFullYear();
      const month = String(initialDate.getMonth() + 1).padStart(2, '0');
      const day = String(initialDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      setDateStr(formattedDate);
      checkHoliday(formattedDate);
    } 
    
    if (isOpen && defaultEmail) {
      setEmail(defaultEmail);
    }

    if (!isOpen) {
      setTitle('');
      setUrgency('Medium');
      setDescription('');
      setEmail('');
      setHolidayWarning(null);
    }
  }, [isOpen, initialDate, defaultEmail]);

  const checkHoliday = (date: string) => {
    const d = new Date(date);
    const dayOfWeek = d.getDay();

    if (TURKISH_HOLIDAYS[date]) {
      setHolidayWarning(TURKISH_HOLIDAYS[date]);
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
      setHolidayWarning('Hafta Sonu');
    } else {
      setHolidayWarning(null);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDateStr(newDate);
    checkHoliday(newDate);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dateStr) {
      alert('Lütfen başlık ve tarih alanlarını doldurun!');
      return;
    }

    const selectedDate = new Date(dateStr);
    onRequest(title, urgency, selectedDate, description, email);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">İş Talebi Oluştur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Talep Başlığı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Örn: Masrafsız İhtiyaç Kredisi"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Calendar size={14} /> Talep Edilen Tarih <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={dateStr}
                onChange={handleDateChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
            {holidayWarning && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle size={12} />
                Dikkat: Seçilen tarih {holidayWarning}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <AlertCircle size={14} /> Aciliyet Durumu
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(URGENCY_CONFIGS) as UrgencyLevel[]).map((level) => {
                const config = URGENCY_CONFIGS[level];
                const isSelected = urgency === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setUrgency(level)}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium text-left border transition-all
                      ${isSelected
                        ? `${config.colorBg} ${config.colorBorder} border ring-1 ring-offset-1 ring-gray-300`
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'}
                    `}
                  >
                    <span className={isSelected ? config.colorText : ''}>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              İletişim E-posta Adresi <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">(Bildirim için)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="ornek@sirket.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <AlignLeft size={14} /> Açıklama <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">(İsteğe Bağlı)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Talep detayları, notlar vb..."
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all resize-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg shadow-lg shadow-violet-200 dark:shadow-none transition-all transform active:scale-95"
            >
              Talep Oluştur
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
