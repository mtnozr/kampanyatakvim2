import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, AlignLeft, AlertTriangle, Building, Gauge } from 'lucide-react';
import { UrgencyLevel, User, Department, DifficultyLevel, CalendarEvent } from '../types';
import { URGENCY_CONFIGS, TURKISH_HOLIDAYS, DIFFICULTY_CONFIGS } from '../constants';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string, urgency: UrgencyLevel, date: Date, assigneeId?: string, description?: string, departmentId?: string, difficulty?: DifficultyLevel, requiresReport?: boolean) => void;
  initialDate?: Date;
  initialData?: {
    title?: string;
    urgency?: UrgencyLevel;
    description?: string;
    departmentId?: string;
  };
  users: User[];
  departments: Department[];
  monthlyBadges?: { trophy: string[], rocket: string[], power: string[] };
  events: CalendarEvent[];
}

export const AddEventModal: React.FC<AddEventModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  initialDate,
  initialData,
  users,
  departments,
  monthlyBadges = { trophy: [], rocket: [], power: [] },
  events
}) => {
  const [title, setTitle] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('Medium');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('ORTA');
  const [dateStr, setDateStr] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [holidayWarning, setHolidayWarning] = useState<string | null>(null);
  const [requiresReport, setRequiresReport] = useState(true);

  // Helper function to convert text to Title Case with Turkish support
  const toTitleCase = (str: string) => {
    return str.split(' ').map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR');
    }).join(' ');
  };

  useEffect(() => {
    if (isOpen) {
      if (initialDate) {
        const year = initialDate.getFullYear();
        const month = String(initialDate.getMonth() + 1).padStart(2, '0');
        const day = String(initialDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        setDateStr(formattedDate);
        checkHoliday(formattedDate);
      }

      if (initialData) {
        setTitle(initialData.title || '');
        setUrgency(initialData.urgency || 'Medium');
        setDescription(initialData.description || '');
        setDepartmentId(initialData.departmentId || '');
      } else if (!initialDate) {
        // Only reset if opening fresh (no date provided implies fully fresh, though typically date is always provided)
        // Actually, if simply opening with a date, we usually reset fields.
        // Logic: If initialData is present, use it. Else reset fields.
      }
    }

    if (!isOpen) {
      // Reset on close
      setTitle('');
      setUrgency('Medium');
      setDifficulty('ORTA');
      setAssigneeId('');
      setDepartmentId('');
      setDescription('');
      setHolidayWarning(null);
      setRequiresReport(true);
    }
  }, [isOpen, initialDate, initialData]);

  const checkHoliday = (date: string) => {
    const d = new Date(date);
    const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday

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
    if (!title || !dateStr || !assigneeId || !departmentId) {
      alert('Lütfen tüm zorunlu alanları doldurun!');
      return;
    }

    const selectedDate = new Date(dateStr);
    onAdd(title, urgency, selectedDate, assigneeId, description, departmentId, difficulty, requiresReport);
    onClose();
    setTitle('');
    setUrgency('Medium');
    setDifficulty('ORTA');
    setAssigneeId('');
    setDepartmentId('');
    setDescription('');
    setHolidayWarning(null);
    setRequiresReport(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Kampanya Ekle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Holiday Warning Popup Inside Modal */}
        {holidayWarning && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/30 p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
            <AlertTriangle className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">Resmi Tatil Uyarısı</h4>
              <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">
                Seçilen tarih <strong>{holidayWarning}</strong> gününe denk gelmektedir.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Kampanya Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(toTitleCase(e.target.value))}
              placeholder="Kampanya adı girin..."
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tarih <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={handleDateChange}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Görev Atanan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 pl-8 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                  required
                >
                  <option value="">Seçiniz</option>
                  {[...users]
                    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
                    .map(user => {
                      const hasPendingEvents = events.some(e => e.assigneeId === user.id && e.status === 'Planlandı');
                      const indicator = hasPendingEvents ? '🔴' : '🟢';
                      return (
                        <option key={user.id} value={user.id}>
                          {indicator} {user.name} {monthlyBadges.trophy.includes(user.id) ? '🏆' : ''}{monthlyBadges.rocket.includes(user.id) ? '🚀' : ''}{monthlyBadges.power.includes(user.id) ? '💪' : ''}
                        </option>
                      );
                    })}
                </select>
                <UserPlus className="absolute left-2.5 top-2.5 text-gray-400 dark:text-gray-500" size={16} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Talep Eden Birim <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 pl-8 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                  required
                >
                  <option value="">Seçiniz</option>
                  {[...departments]
                    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
                    .map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                </select>
                <Building className="absolute left-2.5 top-2.5 text-gray-400 dark:text-gray-500" size={16} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <Gauge size={14} /> Zorluk Seviyesi
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DIFFICULTY_CONFIGS) as DifficultyLevel[]).map((level) => {
                const config = DIFFICULTY_CONFIGS[level];
                const isSelected = difficulty === level;
                return (
                  <label
                    key={level}
                    className={`
                      relative flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all select-none
                      ${isSelected
                        ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 ring-1 ring-violet-500'
                        : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600'}
                    `}
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      value={level}
                      checked={isSelected}
                      onChange={() => setDifficulty(level)}
                      className="w-4 h-4 text-violet-600 border-gray-300 focus:ring-violet-500 dark:bg-slate-600 dark:border-slate-500"
                    />
                    <span className={`text-xs font-medium ${isSelected ? config.textColor : 'text-gray-600 dark:text-gray-300'}`}>
                      {config.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <AlertCircle size={14} /> Aciliyet Durumu <span className="text-red-500">*</span>
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
                        ? `${config.colorBg} ${config.colorBorder} border ring-1 ring-offset-1 ring-gray-300 dark:ring-slate-600 dark:ring-offset-slate-800`
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 dark:text-gray-300'}
                    `}
                  >
                    <span className={isSelected ? config.colorText : ''}>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <AlignLeft size={14} /> Açıklama <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">(İsteğe Bağlı)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kampanya detayları, notlar vb..."
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all resize-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Rapor Yapılacak mı */}
          <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <input
              type="checkbox"
              id="requiresReport"
              checked={requiresReport}
              onChange={(e) => setRequiresReport(e.target.checked)}
              className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 dark:bg-slate-600 dark:border-slate-500"
            />
            <label htmlFor="requiresReport" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              📊 Tamamlandığında rapor oluşturulsun
            </label>
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
              Ekle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};