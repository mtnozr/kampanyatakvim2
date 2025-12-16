import React, { useState, useEffect } from 'react';
import { X, Calendar, User as UserIcon, AlertCircle, AlignLeft, Building, Edit2, Save, XCircle, Trash2, CheckCircle2, XCircle as CancelIcon, Clock, Gauge } from 'lucide-react';
import { CalendarEvent, User, Department, UrgencyLevel, CampaignStatus, DifficultyLevel } from '../types';
import { URGENCY_CONFIGS, STATUS_STYLES, DIFFICULTY_CONFIGS } from '../constants';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface EventDetailsModalProps {
  event: CalendarEvent | null;
  assignee?: User;
  departments: Department[];
  users: User[];
  isDesigner: boolean;
  isKampanyaYapan?: boolean;
  onClose: () => void;
  onEdit?: (eventId: string, updates: Partial<CalendarEvent>) => void;
  onDelete?: (eventId: string) => void;
  monthlyChampionId?: string | null;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  event,
  assignee,
  departments,
  users,
  isDesigner,
  isKampanyaYapan,
  onClose,
  onEdit,
  onDelete,
  monthlyChampionId
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editUrgency, setEditUrgency] = useState<UrgencyLevel>('Medium');
  const [editDifficulty, setEditDifficulty] = useState<DifficultyLevel>('ORTA');
  const [editDescription, setEditDescription] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState('');
  const [status, setStatus] = useState<CampaignStatus>('Planlandı');

  // Helper function to convert text to Title Case with Turkish support
  const toTitleCase = (str: string) => {
    return str.split(' ').map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR');
    }).join(' ');
  };

  useEffect(() => {
    if (event) {
      setEditTitle(event.title);
      setEditDate(format(event.date, 'yyyy-MM-dd'));
      setEditUrgency(event.urgency);
      setEditDifficulty(event.difficulty || 'ORTA');
      setEditDescription(event.description || '');
      setEditAssigneeId(event.assigneeId || '');
      setEditDepartmentId(event.departmentId || '');
      setStatus(event.status || 'Planlandı');
    }
  }, [event]);

  if (!event) return null;

  // Urgency config (always fallback to Low if undefined)
  const urgencyConfig = URGENCY_CONFIGS[event.urgency] ?? URGENCY_CONFIGS['Low'];
  
  // Display config based on LOCAL Status state if exists, otherwise Urgency
  // This allows immediate UI feedback when clicking status buttons
  const displayConfig = (status && STATUS_STYLES[status]) 
    ? STATUS_STYLES[status] 
    : urgencyConfig;

  const department = departments.find(d => d.id === event.departmentId);

  const handleStatusChange = (newStatus: CampaignStatus) => {
    if (!onEdit) return;
    setStatus(newStatus);
    // Immediate update for status
    onEdit(event.id, { status: newStatus });
  };

  const handleSave = () => {
    if (!onEdit || !editTitle.trim()) return;

    onEdit(event.id, {
      title: editTitle,
      date: new Date(editDate),
      urgency: editUrgency,
      difficulty: editDifficulty,
      description: editDescription,
      assigneeId: editAssigneeId || undefined,
      departmentId: editDepartmentId || undefined,
      status: status // Save status as well if changed during edit mode
    });

    setIsEditMode(false);
  };

  const handleCancel = () => {
    // Reset to original values
    setEditTitle(event.title);
    setEditDate(format(event.date, 'yyyy-MM-dd'));
    setEditUrgency(event.urgency);
    setEditDifficulty(event.difficulty || 'ORTA');
    setEditDescription(event.description || '');
    setEditAssigneeId(event.assigneeId || '');
    setEditDepartmentId(event.departmentId || '');
    setStatus(event.status || 'Planlandı');
    setIsEditMode(false);
  };

  const handleDelete = () => {
    if (!onDelete || !event) return;
    if (window.confirm(`"${event.title}" kampanyasını silmek istediğinize emin misiniz?`)) {
      onDelete(event.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh] transition-colors">

        {/* Header with Status/Urgency Color */}
        <div className={`px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-start ${displayConfig.colorBg} bg-opacity-30 shrink-0 transition-colors duration-300`}>
          <div className="flex-1">
             {/* Status Toggle UI for Authorized Users */}
            {(isDesigner || isKampanyaYapan) && (
              <div className="flex bg-white/50 dark:bg-slate-700/50 p-1 rounded-lg border border-gray-200/50 dark:border-slate-600/50 mb-3 w-fit backdrop-blur-sm">
                <button
                  onClick={() => handleStatusChange('Planlandı')}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all ${
                    status === 'Planlandı' 
                    ? 'bg-yellow-100 text-yellow-700 shadow-sm dark:bg-yellow-900/30 dark:text-yellow-300' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600'
                  }`}
                  title="Planlandı"
                >
                  <Clock size={12} /> Planlandı
                </button>
                <button
                  onClick={() => handleStatusChange('Tamamlandı')}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all ${
                    status === 'Tamamlandı' 
                    ? 'bg-green-100 text-green-700 shadow-sm dark:bg-green-900/30 dark:text-green-300' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600'
                  }`}
                  title="Tamamlandı"
                >
                  <CheckCircle2 size={12} /> Tamamlandı
                </button>
                <button
                  onClick={() => handleStatusChange('İptal Edildi')}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all ${
                    status === 'İptal Edildi' 
                    ? 'bg-red-100 text-red-700 shadow-sm dark:bg-red-900/30 dark:text-red-300' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600'
                  }`}
                  title="İptal Edildi"
                >
                  <CancelIcon size={12} /> İptal
                </button>
              </div>
            )}

            <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${displayConfig.colorBorder} ${displayConfig.colorText} bg-white/50 dark:bg-slate-700/50 mb-2`}>
              {displayConfig.label}
            </span>
            {isEditMode ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(toTitleCase(e.target.value))}
                className="text-xl font-bold text-gray-800 dark:text-white leading-tight w-full border-b-2 border-violet-300 dark:border-violet-600 focus:border-violet-600 dark:focus:border-violet-400 outline-none bg-transparent"
                placeholder="Kampanya Başlığı"
              />
            ) : (
              <h2 className={`text-xl font-bold text-gray-800 dark:text-white leading-tight ${status === 'İptal Edildi' ? 'line-through opacity-60' : ''}`}>
                {event.title}
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-white/50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-600 rounded-full p-1 transition-colors ml-2"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">

          {/* Date Section */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-lg shrink-0">
              <Calendar size={20} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Tarih</p>
              {isEditMode ? (
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              ) : (
                <p className="text-gray-800 dark:text-gray-200 font-medium">
                  {format(event.date, 'd MMMM yyyy, EEEE', { locale: tr })}
                </p>
              )}
            </div>
          </div>

          {/* Department Section */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-lg shrink-0">
              <Building size={20} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Talep Eden Birim</p>
              {isEditMode ? (
                <select
                  value={editDepartmentId}
                  onChange={(e) => setEditDepartmentId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value="">Seçiniz</option>
                  {[...departments]
                    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
                    .map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-800 dark:text-gray-200 font-medium">
                  {department ? department.name : 'Belirtilmemiş'}
                </p>
              )}
            </div>
          </div>

          {/* Assignee Section */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
              <UserIcon size={20} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Görevli Personel</p>
              {isEditMode ? (
                <select
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value="">Atama Yok</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.emoji} {user.name} {monthlyChampionId === user.id ? '🏆' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                assignee ? (
                  <div className="flex items-center gap-2 mt-1">
                    {assignee.emoji ? (
                      <span className="text-xl bg-gray-100 dark:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center border border-gray-200 dark:border-slate-600">
                        {assignee.emoji}
                      </span>
                    ) : (
                      <div className="w-8 h-8 bg-violet-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        {assignee.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {assignee.name} {monthlyChampionId === assignee.id ? '🏆' : ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{assignee.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">Atama yapılmadı.</p>
                )
              )}
            </div>
          </div>

          {/* Difficulty Section */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg shrink-0">
              <Gauge size={20} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Zorluk Seviyesi</p>
              {isEditMode ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {(Object.keys(DIFFICULTY_CONFIGS) as DifficultyLevel[]).map((level) => {
                    const config = DIFFICULTY_CONFIGS[level];
                    const isSelected = editDifficulty === level;
                    return (
                      <label
                        key={level}
                        className={`
                          relative flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-all select-none
                          ${isSelected
                            ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 ring-1 ring-violet-500'
                            : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600'}
                        `}
                      >
                        <input
                          type="radio"
                          name="editDifficulty"
                          value={level}
                          checked={isSelected}
                          onChange={() => setEditDifficulty(level)}
                          className="w-3.5 h-3.5 text-violet-600 border-gray-300 focus:ring-violet-500 dark:bg-slate-600 dark:border-slate-500"
                        />
                        <span className={`text-xs font-medium ${isSelected ? config.textColor : 'text-gray-600 dark:text-gray-300'}`}>
                          {config.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${event.difficulty ? DIFFICULTY_CONFIGS[event.difficulty].color : 'bg-gray-100 text-gray-600'} ${event.difficulty ? DIFFICULTY_CONFIGS[event.difficulty].textColor : ''}`}>
                    {event.difficulty ? DIFFICULTY_CONFIGS[event.difficulty].label : 'Belirtilmemiş'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Urgency Section */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 rounded-lg shrink-0">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Aciliyet Seviyesi</p>
              {isEditMode ? (
                <select
                  value={editUrgency}
                  onChange={(e) => setEditUrgency(e.target.value as UrgencyLevel)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value="Low">Düşük (Low)</option>
                  <option value="Medium">Orta (Medium)</option>
                  <option value="High">Yüksek (High)</option>
                  <option value="Critical">Kritik (Critical)</option>
                </select>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  Bu kampanya <strong>{urgencyConfig.label}</strong> öncelik seviyesindedir.
                </p>
              )}
            </div>
          </div>

          {/* Description Section */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-lg shrink-0">
              <AlignLeft size={20} />
            </div>
            <div className="w-full">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Açıklama</p>
              {isEditMode ? (
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm resize-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="Kampanya açıklaması (isteğe bağlı)"
                />
              ) : (
                event.description ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg border border-gray-100 dark:border-slate-700">
                    {event.description}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic mt-1">Açıklama eklenmemiş.</p>
                )
              )}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700/30 border-t border-gray-100 dark:border-slate-700 shrink-0">
          {isDesigner && !isEditMode ? (
            <div className="flex gap-3">
              <button
                onClick={() => setIsEditMode(true)}
                className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Edit2 size={16} /> Düzenle
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 size={16} /> Sil
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white font-medium text-sm transition-colors"
              >
                Kapat
              </button>
            </div>
          ) : isEditMode ? (
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Save size={16} /> Kaydet
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <XCircle size={16} /> İptal
              </button>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={onClose}
                className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                Kapat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};