import React, { useState, useEffect } from 'react';
import { X, Megaphone, Sparkles } from 'lucide-react';
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

    // 0. Check if user is logged in (don't show to guests)
    if (!currentUserId || currentUserId === 'guest') {
      return;
    }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300">
      <div
        className={`
          relative w-full max-w-[550px] max-h-[600px] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl
          overflow-hidden
          transform transition-all duration-500 ease-out
          ${isClosing ? 'opacity-0 scale-90 -translate-y-8' : 'opacity-100 scale-100 translate-y-0'}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
        style={{
          boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.1)'
        }}
      >
        {/* Decorative Background Pattern */}
        <div className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        {/* Close Button - Floating Style */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 text-white/90 hover:text-white transition-all rounded-full p-2 hover:bg-white/20 hover:scale-110 backdrop-blur-sm bg-white/10"
          aria-label="Kapat"
        >
          <X size={20} strokeWidth={2.5} />
        </button>

        {/* Header with Logo */}
        <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 dark:from-violet-700 dark:via-purple-700 dark:to-fuchsia-700 p-8 text-white overflow-hidden">
          {/* Animated Sparkles */}
          <div className="absolute top-4 left-4 animate-pulse">
            <Sparkles size={20} className="text-yellow-300" />
          </div>
          <div className="absolute bottom-6 right-8 animate-pulse" style={{ animationDelay: '0.5s' }}>
            <Sparkles size={16} className="text-yellow-200" />
          </div>

          {/* Logo and Title Container */}
          <div className="relative flex flex-col items-center text-center gap-4">
            {/* Logo with Glow Effect */}
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-full filter blur-xl opacity-40 animate-pulse"></div>
              <div className="relative w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border-2 border-white/30 shadow-2xl">
                <img
                  src="/icon.png"
                  alt="Logo"
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    // Fallback to icon if image fails
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <Megaphone size={28} className="hidden" />
              </div>
            </div>

            {/* Title with Animation */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <span className="text-2xl animate-bounce">📢</span>
                <span className="text-sm font-semibold uppercase tracking-wider">Yeni Duyuru</span>
              </div>
              <p className="text-white/90 text-sm font-medium">
                {format(latestAnnouncement.createdAt, 'd MMMM yyyy, HH:mm', { locale: tr })}
              </p>
            </div>
          </div>

          {/* Decorative Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-6" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,0 C150,100 350,0 600,50 C850,100 1050,0 1200,50 L1200,120 L0,120 Z" fill="currentColor" className="text-white dark:text-slate-800"></path>
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="relative p-8 overflow-y-auto max-h-[340px] custom-scrollbar">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
            {latestAnnouncement.title}
          </h3>

          <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-[15px]">
            {latestAnnouncement.content}
          </div>

          {/* Author Badge */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {latestAnnouncement.createdBy.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Yayınlayan</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{latestAnnouncement.createdBy}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Gradient Button */}
        <div className="relative p-6 bg-gradient-to-t from-gray-50 to-transparent dark:from-slate-900/50">
          <button
            onClick={handleClose}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white font-bold rounded-xl transition-all transform active:scale-95 shadow-lg hover:shadow-xl relative overflow-hidden group"
          >
            <span className="relative z-10">Okudum ✓</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          </button>
        </div>
      </div>
    </div>
  );
};
