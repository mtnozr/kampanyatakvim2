import React, { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import { Announcement } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface AnnouncementPopupProps {
  latestAnnouncement: Announcement | null;
  currentUsername?: string | null;
  currentUserId?: string;
  onMarkAsRead: (announcementId: string) => void;
}

export const AnnouncementPopup: React.FC<AnnouncementPopupProps> = ({
  latestAnnouncement,
  currentUsername,
  currentUserId,
  onMarkAsRead
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!latestAnnouncement) {
      setIsVisible(false);
      return;
    }

    // Reset states for new announcement (ensures popup shows for each new announcement)
    setIsClosing(false);
    setIsVisible(false);

    // 1. Check if user is the creator
    if (currentUsername && latestAnnouncement.createdBy === currentUsername) {
      return;
    }

    // 2. Check if user already read this announcement (DB check)
    if (currentUserId && latestAnnouncement.readBy && latestAnnouncement.readBy.includes(currentUserId)) {
      return;
    }

    // Show popup after a small delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [latestAnnouncement?.id, currentUsername, currentUserId]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isVisible) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isVisible]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);

      // Mark as read when closing
      if (latestAnnouncement && currentUserId) {
        onMarkAsRead(latestAnnouncement.id);
      }
    }, 300);
  };

  if (!isVisible || !latestAnnouncement) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-300">
      <div
        className={`
          relative w-full max-w-[500px] max-h-[500px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl
          border-2 border-violet-200 dark:border-violet-700 overflow-hidden
          transform transition-all duration-300 ease-in-out
          ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-in fade-in zoom-in-95 duration-300'}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-700 dark:to-purple-700 p-6 text-white">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 text-white/80 hover:text-white transition-colors rounded-full p-1.5 hover:bg-white/20"
            aria-label="Kapat"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3 pr-8">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Megaphone size={24} />
            </div>
            <div>
              <h2
                id="announcement-title"
                className="text-xl font-bold"
              >
                📢 Yeni Duyuru
              </h2>
              <p className="text-white/80 text-sm mt-0.5">
                {format(latestAnnouncement.createdAt, 'd MMMM yyyy, HH:mm', { locale: tr })}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[340px]">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {latestAnnouncement.title}
          </h3>

          <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {latestAnnouncement.content}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Yayınlayan: <span className="font-medium text-gray-700 dark:text-gray-300">{latestAnnouncement.createdBy}</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={handleClose}
            className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-violet-200 dark:shadow-none"
          >
            Okudum
          </button>
        </div>
      </div>
    </div>
  );
};
