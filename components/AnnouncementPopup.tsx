import React, { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import { Announcement } from '../types';

interface AnnouncementPopupProps {
  latestAnnouncement: Announcement | null;
}

export const AnnouncementPopup: React.FC<AnnouncementPopupProps> = ({ latestAnnouncement }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (latestAnnouncement) {
      const dismissedId = localStorage.getItem('dismissed_announcement_id');
      
      // If the latest announcement is different from the dismissed one, show popup
      if (dismissedId !== latestAnnouncement.id) {
        // Add a small delay for better UX on page load
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [latestAnnouncement]);

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
        localStorage.setItem('dismissed_announcement_id', latestAnnouncement.id);
      }
    }, 300); // 300ms match animation duration
  };

  if (!isVisible || !latestAnnouncement) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/10 backdrop-blur-[1px] transition-opacity duration-300">
      <div 
        className={`
          relative w-full max-w-[320px] bg-white dark:bg-slate-800 rounded-xl shadow-xl 
          border border-gray-100 dark:border-slate-700 p-5
          transform transition-all duration-300 ease-in-out
          ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-in fade-in zoom-in-95 duration-300'}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
      >
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-full p-1 hover:bg-gray-100 dark:hover:bg-slate-700"
          aria-label="Kapat"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center space-y-3 pt-1">
          <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center mb-1">
            <Megaphone size={18} />
          </div>

          <div className="space-y-1">
            <h2 
              id="announcement-title" 
              className="text-lg font-bold text-gray-800 dark:text-gray-100"
            >
              Yeni Bir Duyuru Var
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              Duyurular bölümünden detayları inceleyebilirsiniz.
            </p>
          </div>

          <button
            onClick={handleClose}
            className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors mt-2"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
