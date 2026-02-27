import React, { useEffect, useRef } from 'react';
import { AppNotification } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Mail, Bell, Pin, CheckCircle2, AlertTriangle, CalendarClock, Clock3, type LucideIcon } from 'lucide-react';

interface NotificationPopoverProps {
  notifications: AppNotification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
}

interface NotificationVisual {
  icon: LucideIcon;
  iconClassName: string;
}

const getNotificationVisual = (notification: AppNotification): NotificationVisual => {
  const normalizedTitle = notification.title.toLocaleLowerCase('tr-TR');

  if (normalizedTitle.includes('atama')) {
    return { icon: Pin, iconClassName: 'bg-indigo-100 text-indigo-600' };
  }

  if (normalizedTitle.includes('tamamlandı')) {
    return { icon: CheckCircle2, iconClassName: 'bg-emerald-100 text-emerald-600' };
  }

  if (normalizedTitle.includes('silindi') || normalizedTitle.includes('iptal')) {
    return { icon: AlertTriangle, iconClassName: 'bg-rose-100 text-rose-600' };
  }

  if (normalizedTitle.includes('planlandı')) {
    return { icon: CalendarClock, iconClassName: 'bg-amber-100 text-amber-700' };
  }

  if (notification.type === 'email') {
    return { icon: Mail, iconClassName: 'bg-blue-100 text-blue-600' };
  }

  return { icon: Bell, iconClassName: 'bg-gray-100 text-gray-600' };
};

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({ notifications, isOpen, onClose, onMarkAllRead }) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to prevent immediate close when clicking the bell button
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute top-16 right-4 md:right-20 z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2"
    >
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-gray-700">Bildirimler</h3>
        {notifications.length > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-violet-600 hover:text-violet-800 font-medium"
          >
            Tümünü Okundu İşaretle
          </button>
        )}
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Bell className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm">Henüz bildirim yok.</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="rounded-xl border border-gray-100 bg-white p-3 hover:border-violet-200 hover:shadow-sm transition-all"
              >
                <div className="flex gap-3 items-start">
                  {(() => {
                    const visual = getNotificationVisual(notif);
                    const Icon = visual.icon;
                    return (
                      <div className={`p-2 rounded-lg shrink-0 ${visual.iconClassName}`}>
                        <Icon size={16} />
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-gray-800 leading-5">{notif.title}</h4>
                    <p className="text-xs text-gray-600 mt-1 leading-5 break-words">{notif.message}</p>
                    <div className="mt-2 flex justify-end items-center gap-1 text-[11px] text-gray-500">
                      <Clock3 size={12} />
                      <span>{format(notif.date, 'HH:mm', { locale: tr })}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
