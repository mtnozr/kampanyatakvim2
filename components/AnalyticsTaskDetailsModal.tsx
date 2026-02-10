import React, { useState, useEffect } from 'react';
import { X, Briefcase, Calendar, User as UserIcon, Trash2, Save, CheckCircle2, Clock, XCircle, Mail, FileText, PauseCircle } from 'lucide-react';
import { AnalyticsTask, AnalyticsUser, UrgencyLevel, CampaignStatus } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { URGENCY_CONFIGS } from '../constants';

interface AnalyticsTaskDetailsModalProps {
    isOpen: boolean;
    task: AnalyticsTask | null;
    users: AnalyticsUser[];
    onClose: () => void;
    onUpdate: (taskId: string, updates: Partial<AnalyticsTask>) => Promise<void>;
    onDelete: (taskId: string) => Promise<void>;
    onUpdateStatus: (taskId: string, status: CampaignStatus) => Promise<void>;
    canEdit: boolean;        // Admin can edit
    canChangeStatus: boolean; // Analitik or Admin can change status
}

export const AnalyticsTaskDetailsModal: React.FC<AnalyticsTaskDetailsModalProps> = ({
    isOpen,
    task,
    users,
    onClose,
    onUpdate,
    onDelete,
    onUpdateStatus,
    canEdit,
    canChangeStatus
}) => {
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [urgency, setUrgency] = useState<UrgencyLevel>('Medium');
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [dueDate, setDueDate] = useState<Date>(new Date());
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    useEffect(() => {
        if (isOpen && task) {
            setTitle(task.title);
            setNotes(task.notes || '');
            setUrgency(task.urgency);
            setAssigneeId(task.assigneeId || '');
            setDueDate(task.date);
            setIsEditing(false);
            setShowDeleteConfirm(false);
        }
    }, [isOpen, task]);

    if (!isOpen || !task) return null;

    const assignee = users.find(u => u.id === task.assigneeId);
    const status = task.status || 'Planlandı';
    const now = new Date();

    const formatDuration = (start: Date, end: Date) => {
        const diffMs = end.getTime() - start.getTime();
        if (diffMs < 0) return '';

        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        const hours = diffHours % 24;

        if (diffDays > 0) return `${diffDays} gün, ${hours} saat`;
        if (hours > 0) return `${hours} saat`;
        return `${diffMins} dk`;
    };

    const handleSave = async () => {
        if (!title.trim()) return;

        setIsSaving(true);
        try {
            await onUpdate(task.id, {
                title: title.trim(),
                notes: notes.trim() || undefined,
                urgency,
                assigneeId: assigneeId || undefined,
                date: dueDate
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
            await onDelete(task.id);
            onClose();
        } catch (e) {
            console.error('Delete failed:', e);
        }
        setIsDeleting(false);
    };

    const handleStatusChange = async (newStatus: CampaignStatus) => {
        setIsUpdatingStatus(true);
        try {
            await onUpdateStatus(task.id, newStatus);
        } catch (e) {
            console.error('Status change failed:', e);
        }
        setIsUpdatingStatus(false);
    };

    const handleRequestInfo = () => {
        if (!assignee?.email) {
            alert('Bu iş için görevli personel atanmamış veya e-posta adresi bulunmuyor.');
            return;
        }

        const subject = `[Analitik İş Bilgi Talebi] - ${task.title}`;
        const assigneeName = assignee.name.split(' ')[0];
        const body = `Merhaba ${assigneeName},\n\n"${task.title}" başlıklı iş hakkında güncel durum ve ilerleme bilgisini paylaşabilir misin?`;

        window.location.href = `mailto:${assignee.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const getHeaderColor = () => {
        switch (status) {
            case 'Tamamlandı':
                return 'bg-gradient-to-r from-emerald-600 to-teal-600';
            case 'İptal Edildi':
                return 'bg-gradient-to-r from-gray-600 to-slate-600';
            default:
                return 'bg-gradient-to-r from-blue-600 to-indigo-600';
        }
    };

    const getStatusBadge = () => {
        switch (status) {
            case 'Tamamlandı':
                return (
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium dark:bg-emerald-800 dark:text-emerald-200">
                        <CheckCircle2 size={16} />
                        Tamamlandı
                    </span>
                );
            case 'İptal Edildi':
                return (
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium dark:bg-gray-800 dark:text-gray-200">
                        <XCircle size={16} />
                        İptal Edildi
                    </span>
                );
            default:
                return (
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium dark:bg-blue-800 dark:text-blue-200">
                        <Clock size={16} />
                        Planlandı
                    </span>
                );
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-slate-700 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className={`p-5 ${getHeaderColor()} shrink-0`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Briefcase className="text-white/90" size={24} />
                            <h2 className="text-xl font-bold text-white">Analitik İş Detayı</h2>
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
                <div className="p-6 space-y-5 overflow-y-auto">
                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                        {getStatusBadge()}
                    </div>

                    {/* Task Title */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <Briefcase size={16} className="text-blue-500" />
                            İşin Adı
                        </label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none transition-all text-gray-800 dark:text-white"
                            />
                        ) : (
                            <p className="text-gray-800 dark:text-white font-medium">{task.title}</p>
                        )}
                    </div>

                    {/* Assignee */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <UserIcon size={16} className="text-blue-500" />
                            Görevlendirilen
                        </label>
                        {isEditing ? (
                            <select
                                value={assigneeId}
                                onChange={(e) => setAssigneeId(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none transition-all text-gray-800 dark:text-white appearance-none"
                            >
                                <option value="">Kişi Seçin</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.emoji} {user.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{assignee?.emoji || '👤'}</span>
                                <p className="text-gray-800 dark:text-white">
                                    {assignee ? assignee.name : 'Atanmamış'}
                                </p>
                                {canEdit && assignee?.email && (
                                    <button
                                        onClick={handleRequestInfo}
                                        className="ml-auto px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1 dark:bg-blue-900/30 dark:text-blue-300"
                                    >
                                        <Mail size={12} />
                                        Bilgi Talep Et
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Due Date */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <Calendar size={16} className="text-blue-500" />
                            Tarih
                        </label>
                        {isEditing ? (
                            <input
                                type="date"
                                value={format(dueDate, 'yyyy-MM-dd')}
                                onChange={(e) => setDueDate(new Date(e.target.value))}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none transition-all text-gray-800 dark:text-white"
                            />
                        ) : (
                            <p className="text-gray-800 dark:text-white font-medium">
                                {format(task.date, 'd MMMM yyyy, EEEE', { locale: tr })}
                            </p>
                        )}
                    </div>

                    {/* Time Tracking */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <Clock size={16} className="text-blue-500" />
                            Süre Bilgileri
                        </label>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800/40 space-y-1">
                            <p className="text-sm text-gray-700 dark:text-gray-300 flex justify-between">
                                <span className="font-semibold text-gray-500 dark:text-gray-400">Başlangıç:</span>
                                <span>{format(task.date, 'd MMMM yyyy', { locale: tr })}</span>
                            </p>
                            {status === 'Tamamlandı' ? (
                                <p className="text-sm text-gray-700 dark:text-gray-300 flex justify-between border-t border-blue-100 dark:border-blue-800/40 pt-1 mt-1">
                                    <span className="font-semibold text-gray-500 dark:text-gray-400">Tamamlanma Süresi:</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        {task.updatedAt ? formatDuration(task.date, task.updatedAt) : ''}
                                    </span>
                                </p>
                            ) : (
                                <p className="text-sm text-gray-700 dark:text-gray-300 flex justify-between border-t border-blue-100 dark:border-blue-800/40 pt-1 mt-1">
                                    <span className="font-semibold text-gray-500 dark:text-gray-400">Geçen Süre:</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">
                                        {now >= task.date ? formatDuration(task.date, now) : ''}
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Urgency */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Aciliyet
                        </label>
                        {isEditing ? (
                            <div className="grid grid-cols-2 gap-2">
                                {(Object.keys(URGENCY_CONFIGS) as UrgencyLevel[]).map((level) => {
                                    const config = URGENCY_CONFIGS[level];
                                    const isSelected = urgency === level;
                                    return (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => setUrgency(level)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${isSelected ? `${config.colorBg} ${config.colorBorder}` : 'bg-white border-gray-200 dark:bg-slate-700 dark:border-slate-600'}`}
                                        >
                                            <span className={isSelected ? config.colorText : 'text-gray-600 dark:text-gray-300'}>{config.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${URGENCY_CONFIGS[task.urgency].colorBg} ${URGENCY_CONFIGS[task.urgency].colorText}`}>
                                {URGENCY_CONFIGS[task.urgency].label}
                            </span>
                        )}
                    </div>

                    {/* Difficulty - Only visible to Admin */}
                    {canEdit && task.difficulty && (
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Zorluk Seviyesi
                            </label>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${task.difficulty === 'Kolay' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                task.difficulty === 'Zor' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                {task.difficulty}
                            </span>
                        </div>
                    )}

                    {/* Notes */}
                    {(task.notes || isEditing) && (
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                <FileText size={16} className="text-blue-500" />
                                Notlar
                            </label>
                            {isEditing ? (
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none transition-all text-gray-800 dark:text-white resize-none"
                                />
                            ) : (
                                <p className="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-wrap">{task.notes}</p>
                            )}
                        </div>
                    )}

                    {/* Delete Confirmation */}
                    {showDeleteConfirm && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800">
                            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                                Bu işi silmek istediğinizden emin misiniz?
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

                    {/* Status Change Buttons */}
                    {canChangeStatus && !showDeleteConfirm && (
                        <div className="pt-2">
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Durumu Değiştir
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                <button
                                    onClick={() => handleStatusChange('Planlandı')}
                                    disabled={isUpdatingStatus || status === 'Planlandı'}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${status === 'Planlandı' ? 'bg-blue-200 text-blue-800 cursor-default' : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400'}`}
                                >
                                    <Clock size={16} />
                                    Planlandı
                                </button>
                                <button
                                    onClick={() => handleStatusChange('Bekleme')}
                                    disabled={isUpdatingStatus || status === 'Bekleme'}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${status === 'Bekleme' ? 'bg-amber-200 text-amber-800 cursor-default' : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'}`}
                                >
                                    <PauseCircle size={16} />
                                    Bekleme
                                </button>
                                <button
                                    onClick={() => handleStatusChange('Tamamlandı')}
                                    disabled={isUpdatingStatus || status === 'Tamamlandı'}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${status === 'Tamamlandı' ? 'bg-emerald-200 text-emerald-800 cursor-default' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'}`}
                                >
                                    <CheckCircle2 size={16} />
                                    Tamamlandı
                                </button>
                                <button
                                    onClick={() => handleStatusChange('İptal Edildi')}
                                    disabled={isUpdatingStatus || status === 'İptal Edildi'}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${status === 'İptal Edildi' ? 'bg-gray-200 text-gray-800 cursor-default' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-400'}`}
                                >
                                    <XCircle size={16} />
                                    İptal
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Admin Actions */}
                    {canEdit && !showDeleteConfirm && (
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
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-none hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Save size={18} />
                                        {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            Düzenle
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="flex-1 px-4 py-3 bg-red-100 text-red-600 rounded-xl font-medium hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Trash2 size={18} />
                                            Sil
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Close Button */}
                    {!canEdit && !canChangeStatus && (
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

export default AnalyticsTaskDetailsModal;
