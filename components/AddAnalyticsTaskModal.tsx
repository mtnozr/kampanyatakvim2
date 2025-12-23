import React, { useState, useEffect } from 'react';
import { X, Briefcase, AlertCircle, Calendar, User as UserIcon, FileText, AlertTriangle } from 'lucide-react';
import { UrgencyLevel, AnalyticsUser } from '../types';
import { URGENCY_CONFIGS, TURKISH_HOLIDAYS } from '../constants';

interface AddAnalyticsTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (title: string, urgency: UrgencyLevel, date: Date, assigneeId?: string, notes?: string, difficulty?: 'Kolay' | 'Orta' | 'Zor') => void;
    initialDate?: Date;
    users: AnalyticsUser[];
}

export const AddAnalyticsTaskModal: React.FC<AddAnalyticsTaskModalProps> = ({
    isOpen,
    onClose,
    onAdd,
    initialDate,
    users
}) => {
    const [title, setTitle] = useState('');
    const [urgency, setUrgency] = useState<UrgencyLevel>('Medium');
    const [dateStr, setDateStr] = useState('');
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [difficulty, setDifficulty] = useState<'Kolay' | 'Orta' | 'Zor'>('Orta');
    const [holidayWarning, setHolidayWarning] = useState<string | null>(null);

    // Helper function to convert text to Title Case with Turkish support
    const toTitleCase = (str: string) => {
        return str.split(' ').map(word => {
            if (word.length === 0) return word;
            return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR');
        }).join(' ');
    };

    useEffect(() => {
        if (isOpen && initialDate) {
            const year = initialDate.getFullYear();
            const month = String(initialDate.getMonth() + 1).padStart(2, '0');
            const day = String(initialDate.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;
            setDateStr(formattedDate);
            checkHoliday(formattedDate);
        }

        if (!isOpen) {
            setTitle('');
            setUrgency('Medium');
            setAssigneeId('');
            setNotes('');
            setDifficulty('Orta');
            setHolidayWarning(null);
        }
    }, [isOpen, initialDate]);

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
        if (!title || !dateStr || !assigneeId) {
            alert('Lütfen tüm zorunlu alanları doldurun!');
            return;
        }

        const selectedDate = new Date(dateStr);
        onAdd(title, urgency, selectedDate, assigneeId, notes, difficulty);
        onClose();
        setTitle('');
        setUrgency('Medium');
        setAssigneeId('');
        setNotes('');
        setDifficulty('Orta');
        setHolidayWarning(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-blue-50/50 dark:bg-slate-800/50 shrink-0">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Briefcase size={20} className="text-blue-600" />
                        Analitik İş Ekle
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Holiday Warning */}
                {holidayWarning && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/30 p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
                        <AlertTriangle className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">Tatil Uyarısı</h4>
                            <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">
                                Seçilen tarih <strong>{holidayWarning}</strong> gününe denk gelmektedir.
                            </p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            İşin Adı <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(toTitleCase(e.target.value))}
                            placeholder="İşin adını girin..."
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
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
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Görevlendirilen <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={assigneeId}
                                onChange={(e) => setAssigneeId(e.target.value)}
                                className="w-full px-3 py-2 pl-8 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                                required
                            >
                                <option value="">Seçiniz</option>
                                {[...users]
                                    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
                                    .map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.emoji || '👤'} {user.name}
                                        </option>
                                    ))}
                            </select>
                            <UserIcon className="absolute left-2.5 top-2.5 text-gray-400 dark:text-gray-500" size={16} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                            <AlertCircle size={14} /> Aciliyet <span className="text-red-500">*</span>
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Zorluk Seviyesi <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['Kolay', 'Orta', 'Zor'] as const).map((level) => {
                                const isSelected = difficulty === level;
                                const colorConfig = {
                                    Kolay: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', border: 'border-green-300 dark:border-green-700' },
                                    Orta: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-700' },
                                    Zor: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-300 dark:border-red-700' }
                                }[level];
                                return (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => setDifficulty(level)}
                                        className={`
                                            px-3 py-2 rounded-lg text-sm font-medium text-center border transition-all
                                            ${isSelected
                                                ? `${colorConfig.bg} ${colorConfig.border} border ring-1 ring-offset-1 ring-gray-300 dark:ring-slate-600 dark:ring-offset-slate-800`
                                                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 dark:text-gray-300'}
                                        `}
                                    >
                                        <span className={isSelected ? colorConfig.text : ''}>{level}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                            <FileText size={14} /> Notlar <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">(İsteğe Bağlı)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ek notlar, detaylar..."
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
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
                            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all transform active:scale-95"
                        >
                            Ekle
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddAnalyticsTaskModal;
