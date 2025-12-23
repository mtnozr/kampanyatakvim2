import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, User as UserIcon, Trash2, Save, CheckCircle2, AlertTriangle, Clock, Tag } from 'lucide-react';
import { Report, User } from '../types';
import { format, isBefore } from 'date-fns';
import { tr } from 'date-fns/locale';

interface ReportDetailsModalProps {
    isOpen: boolean;
    report: Report | null;
    users: User[];
    onClose: () => void;
    onUpdate: (reportId: string, updates: Partial<Report>) => Promise<void>;
    onDelete: (reportId: string) => Promise<void>;
    onMarkDone: (reportId: string) => Promise<void>;
    canEdit: boolean;
}

export const ReportDetailsModal: React.FC<ReportDetailsModalProps> = ({
    isOpen,
    report,
    users,
    onClose,
    onUpdate,
    onDelete,
    onMarkDone,
    canEdit
}) => {
    const [title, setTitle] = useState('');
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [dueDate, setDueDate] = useState<Date>(new Date());
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Reset form when modal opens or report changes
    useEffect(() => {
        if (isOpen && report) {
            setTitle(report.title);
            setAssigneeId(report.assigneeId || '');
            setDueDate(report.dueDate);
            setIsEditing(false);
            setShowDeleteConfirm(false);
        }
    }, [isOpen, report]);

    if (!isOpen || !report) return null;

    const isOverdue = isBefore(report.dueDate, new Date()) && report.status === 'pending';
    const assignee = users.find(u => u.id === report.assigneeId);

    const handleSave = async () => {
        if (!title.trim()) return;

        setIsSaving(true);
        try {
            await onUpdate(report.id, {
                title: title.trim(),
                assigneeId: assigneeId || undefined,
                dueDate
            });
            setIsEditing(false);
        } catch (e) {
            console.error('Save failed:', e);
        }
        setIsSaving(false);
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await onDelete(report.id);
            onClose();
        } catch (e) {
            console.error('Delete failed:', e);
        }
        setIsDeleting(false);
    };

    const handleMarkDone = async () => {
        await onMarkDone(report.id);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-slate-700">
                {/* Header */}
                <div className={`p-5 ${isOverdue ? 'bg-gradient-to-r from-red-600 to-rose-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="text-white/90" size={24} />
                            <h2 className="text-xl font-bold text-white">Rapor Detayları</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                        {report.status === 'done' ? (
                            <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium dark:bg-emerald-800 dark:text-emerald-200">
                                <CheckCircle2 size={16} />
                                Tamamlandı
                            </span>
                        ) : isOverdue ? (
                            <span className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium dark:bg-red-800 dark:text-red-200">
                                <AlertTriangle size={16} />
                                Gecikmiş
                            </span>
                        ) : (
                            <span className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium dark:bg-amber-800 dark:text-amber-200">
                                <Clock size={16} />
                                Bekliyor
                            </span>
                        )}
                        {report.isAutoGenerated && (
                            <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium dark:bg-violet-800 dark:text-violet-200">
                                Otomatik
                            </span>
                        )}
                    </div>

                    {/* Report Title */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <FileText size={16} className="text-emerald-500" />
                            Rapor Adı
                        </label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-white"
                            />
                        ) : (
                            <p className="text-gray-800 dark:text-white font-medium">{report.title}</p>
                        )}
                    </div>

                    {/* Campaign Reference */}
                    {report.campaignTitle && (
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                <Tag size={16} className="text-violet-500" />
                                İlgili Kampanya
                            </label>
                            <p className="text-gray-600 dark:text-gray-400">{report.campaignTitle}</p>
                        </div>
                    )}

                    {/* Assignee */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <UserIcon size={16} className="text-emerald-500" />
                            Atanan Kişi
                        </label>
                        {isEditing ? (
                            <select
                                value={assigneeId}
                                onChange={(e) => setAssigneeId(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-white appearance-none"
                            >
                                <option value="">Kişi Seçin</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.emoji} {user.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-gray-800 dark:text-white">
                                {assignee ? `${assignee.emoji} ${assignee.name}` : 'Atanmamış'}
                            </p>
                        )}
                    </div>

                    {/* Due Date */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <Calendar size={16} className="text-emerald-500" />
                            Teslim Tarihi
                        </label>
                        {isEditing ? (
                            <input
                                type="date"
                                value={format(dueDate, 'yyyy-MM-dd')}
                                onChange={(e) => setDueDate(new Date(e.target.value))}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 outline-none transition-all text-gray-800 dark:text-white"
                            />
                        ) : (
                            <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-800 dark:text-white'}`}>
                                {format(report.dueDate, 'd MMMM yyyy, EEEE', { locale: tr })}
                            </p>
                        )}
                    </div>

                    {/* Completed Info */}
                    {report.status === 'done' && report.completedAt && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                            <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                ✅ {format(report.completedAt, 'd MMMM yyyy, HH:mm', { locale: tr })} tarihinde tamamlandı
                            </p>
                        </div>
                    )}

                    {/* Delete Confirmation */}
                    {showDeleteConfirm && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800">
                            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                                Bu raporu silmek istediğinizden emin misiniz?
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                                >
                                    {isDeleting ? 'Siliniyor...' : 'Evet, Sil'}
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 dark:bg-slate-600 dark:text-gray-200"
                                >
                                    İptal
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    {canEdit && report.status === 'pending' && !showDeleteConfirm && (
                        <div className="flex flex-col gap-3 pt-2">
                            {isEditing ? (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="flex-1 px-4 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || !title.trim()}
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Save size={18} />
                                        {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={handleMarkDone}
                                        className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 size={18} />
                                        Raporu Tamamla
                                    </button>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            Düzenle
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="px-4 py-3 bg-red-100 text-red-600 rounded-xl font-medium hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors flex items-center gap-2"
                                        >
                                            <Trash2 size={18} />
                                            Sil
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Close Button for completed reports or non-editors */}
                    {(report.status === 'done' || !canEdit) && (
                        <button
                            onClick={onClose}
                            className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            Kapat
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportDetailsModal;
