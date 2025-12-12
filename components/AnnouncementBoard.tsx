import React from 'react';
import { Announcement } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { X, Megaphone } from 'lucide-react';

interface AnnouncementBoardProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: Announcement[];
}

export const AnnouncementBoard: React.FC<AnnouncementBoardProps> = ({ isOpen, onClose, announcements }) => {
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
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {announcements.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              Henüz duyuru bulunmamaktadır.
            </div>
          ) : (
            announcements.map((ann) => (
              <div key={ann.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg text-gray-800">{ann.title}</h3>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                    {format(ann.createdAt, 'd MMMM yyyy HH:mm', { locale: tr })}
                  </span>
                </div>
                <p className="text-gray-600 text-sm whitespace-pre-wrap">{ann.content}</p>
                 <div className="mt-3 flex justify-end">
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
