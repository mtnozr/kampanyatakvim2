import React, { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import { Announcement } from '../types';

interface AnnouncementPopupProps {
  latestAnnouncement: Announcement | null;
  currentUsername?: string | null;
  currentUserId?: string;
}

export const AnnouncementPopup: React.FC<AnnouncementPopupProps> = ({ latestAnnouncement, currentUsername, currentUserId }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (latestAnnouncement) {
      const storageKey = `dismissed_announcement_id_${currentUsername || 'guest'}`;
      const dismissedId = localStorage.getItem(storageKey);

      // 1. Check if user is the creator
      if (currentUsername && latestAnnouncement.createdBy === currentUsername) {
        return;
      }

      // 2. Check if user already read this announcement (DB check)
      if (currentUserId && latestAnnouncement.readBy && latestAnnouncement.readBy.includes(currentUserId)) {
        return;
      }
      
      // 3. Check if user dismissed this specific announcement before (Local Storage check)
      if (dismissedId !== latestAnnouncement.id) {
        // Add a small delay for better UX on page load
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [latestAnnouncement, currentUsername, currentUserId]);

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
      if (latestAnnouncement) {
        const storageKey = `dismissed_announcement_id_${currentUsername || 'guest'}`;
        localStorage.setItem(storageKey, latestAnnouncement.id);
      }
    }, 300); // 300ms match animation duration
  };

  if (!isVisible || !latestAnnouncement) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/10 backdrop-blur-[1px] transition-opacity duration-300">
      <div 
        className={`
          relative w-full max-w-[280px] bg-white dark:bg-slate-800 rounded-xl shadow-xl 
          border border-gray-200 dark:border-slate-700 p-4
          transform transition-all duration-300 ease-in-out
          ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-in fade-in zoom-in-95 duration-300'}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
      >
        <button
          onClick={handleClose}
          className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-full p-1 hover:bg-gray-100 dark:hover:bg-slate-700"
          aria-label="Kapat"
        >
          <X size={14} />
        </button>

        <div className="flex flex-col items-center text-center space-y-2 pt-1">
          <div className="w-8 h-8 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 rounded-full flex items-center justify-center mb-0.5">
            <Megaphone size={16} />
          </div>

          <div className="space-y-1">
            <h2 
              id="announcement-title" 
              className="text-base font-bold text-gray-800 dark:text-gray-100"
            >
              Yeni Duyuru
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-[11px] leading-tight px-2">
              Duyurular bölümünden detayları inceleyebilirsiniz.
            </p>
          </div>

          <button
            onClick={handleClose}
            className="w-full py-1.5 px-3 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors mt-2"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
