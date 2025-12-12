import React, { useState, useEffect } from 'react';
import { Announcement } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { X, Megaphone, Trash2, Plus, CheckCircle } from 'lucide-react';

interface AnnouncementBoardProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: Announcement[];
  canManage: boolean;
  onAddAnnouncement: (title: string, content: string, visibleTo: 'admin' | 'kampanya' | 'all') => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  onMarkAsRead: (ids: string[]) => void;
}

export const AnnouncementBoard: React.FC<AnnouncementBoardProps> = ({ 
  isOpen, 
  onClose, 
  announcements, 
  canManage,
  onAddAnnouncement,
  onDeleteAnnouncement,
  onMarkAsRead
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newVisibleTo, setNewVisibleTo] = useState<'admin' | 'kampanya' | 'all'>('all');
  const [error, setError] = useState('');

  // Mark displayed announcements as read when opened
  useEffect(() => {
    if (isOpen && announcements.length > 0) {
      const unreadIds = announcements.map(a => a.id);
      // We send all IDs, the parent component handles filtering which ones are actually unread for the user
      onMarkAsRead(unreadIds);
    }
  }, [isOpen, announcements]); // Removing onMarkAsRead from deps to avoid loops if reference changes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      setError('Başlık ve içerik zorunludur.');
      return;
    }

    try {
      await onAddAnnouncement(newTitle, newContent, newVisibleTo);
      setNewTitle('');
      setNewContent('');
      setNewVisibleTo('all');
      setIsAdding(false);
      setError('');
    } catch (e) {
      setError('Duyuru eklenirken hata oluştu.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800">
            <Megaphone className="text-violet-600" size={24} />
            <h2 className="text-lg font-bold">Duyurular</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add Announcement Section for Admins/Designers */}
          {canManage && (
            <div className="mb-6">
              {!isAdding ? (
                <button 
                  onClick={() => setIsAdding(true)}
                  className="w-full py-3 border-2 border-dashed border-violet-200 rounded-xl text-violet-600 font-medium hover:bg-violet-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={20} /> Yeni Duyuru Yayınla
                </button>
              ) : (
                <div className="bg-slate-50 p-4 rounded-xl border border-violet-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700">Yeni Duyuru</h3>
                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Başlık"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                    />
                    <textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="İçerik"
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                    />
                    <select
                      value={newVisibleTo}
                      onChange={(e) => setNewVisibleTo(e.target.value as any)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white"
                    >
                      <option value="all">Herkese Açık</option>
                      <option value="kampanya">Sadece Kampanya & Admin</option>
                      <option value="admin">Sadece Admin</option>
                    </select>
                    <div className="flex justify-between items-center">
                      <span className="text-red-500 text-xs">{error}</span>
                      <button 
                        type="submit"
                        className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
                      >
                        Yayınla
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {announcements.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              Henüz duyuru bulunmamaktadır.
            </div>
          ) : (
            announcements.map((ann) => (
              <div key={ann.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg text-gray-800">{ann.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                      {format(ann.createdAt, 'd MMMM yyyy HH:mm', { locale: tr })}
                    </span>
                    {canManage && (
                      <button 
                        onClick={() => onDeleteAnnouncement(ann.id)}
                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-gray-600 text-sm whitespace-pre-wrap">{ann.content}</p>
                 <div className="mt-3 flex justify-between items-end">
                    <div className="flex gap-2">
                       <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          ann.visibleTo === 'all' ? 'bg-green-50 text-green-600 border-green-100' :
                          ann.visibleTo === 'kampanya' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          'bg-purple-50 text-purple-600 border-purple-100'
                        }`}>
                          {ann.visibleTo === 'all' ? 'Herkese' : ann.visibleTo === 'kampanya' ? 'Kampanya' : 'Admin'}
                       </span>
                    </div>
                    <span className="text-xs text-violet-500 font-medium">
                        {ann.createdBy} tarafından
                    </span>
                 </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
