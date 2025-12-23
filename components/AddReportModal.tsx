import React, { useState } from 'react';
import { X, Calendar, User as UserIcon, FileText } from 'lucide-react';
import { User } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface AddReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (title: string, assigneeId: string | undefined, dueDate: Date) => void;
    initialDate?: Date;
    users: User[];
}

export const AddReportModal: React.FC<AddReportModalProps> = ({
    isOpen,
    onClose,
    onAdd,
    initialDate,
    users
}) => {
    const [title, setTitle] = useState('');
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [dueDate, setDueDate] = useState(initialDate || new Date());

    // Reset form when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setTitle('');
            setAssigneeId('');
            setDueDate(initialDate || new Date());
        }
    }, [isOpen, initialDate]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        onAdd(title.trim(), assigneeId || undefined, dueDate);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-slate-700">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="text-white/90" size={24} />
                            <h2 className="text-xl font-bold text-white">Yeni Rapor Ekle</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Report Title */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <FileText size={16} className="text-emerald-500" />
                            Rapor Adı *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Rapor başlığını girin..."
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-white"
                            required
                            autoFocus
                        />
                    </div>

                    {/* Assignee */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <UserIcon size={16} className="text-emerald-500" />
                            Atanan Kişi
                        </label>
                        <select
                            value={assigneeId}
                            onChange={(e) => setAssigneeId(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-white appearance-none"
                        >
                            <option value="">Kişi Seçin (Opsiyonel)</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.emoji} {user.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Due Date */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <Calendar size={16} className="text-emerald-500" />
                            Teslim Tarihi *
                        </label>
                        <input
                            type="date"
                            value={format(dueDate, 'yyyy-MM-dd')}
                            onChange={(e) => setDueDate(new Date(e.target.value))}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-white"
                            required
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={!title.trim()}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Rapor Ekle
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddReportModal;
