import React from 'react';
import { CalendarEvent, User } from '../types';
import { URGENCY_CONFIGS, STATUS_STYLES } from '../constants';
import { User as UserIcon, StickyNote, Flame, Zap } from 'lucide-react';

interface EventBadgeProps {
  event: CalendarEvent;
  user?: User;
  onClick: (event: CalendarEvent) => void;
  isBlurred?: boolean;
  isClickable?: boolean;
  monthlyBadges?: { trophy: string[], rocket: string[], power: string[] };
}

export const EventBadge: React.FC<EventBadgeProps> = ({
  event,
  user,
  onClick,
  isBlurred = false,
  isClickable = true,
  monthlyBadges = { trophy: [], rocket: [], power: [] }
}) => {
  // Eğer status varsa STATUS_STYLES, yoksa URGENCY_CONFIGS kullanılır
  const config = (event.status && STATUS_STYLES[event.status])
    ? STATUS_STYLES[event.status]
    : (URGENCY_CONFIGS[event.urgency] ?? URGENCY_CONFIGS['Low']);
  const priorityBadge = !isBlurred
    ? event.urgency === 'Very High'
      ? { label: 'KRİTİK', icon: Flame, className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/35 dark:text-red-200 dark:border-red-700/60' }
      : event.urgency === 'High'
        ? { label: 'YÜKSEK', icon: Zap, className: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/35 dark:text-orange-200 dark:border-orange-700/60' }
        : null
    : null;
  const PriorityIcon = priorityBadge?.icon;

  const renderAvatar = () => {
    if (!user) {
      return (
        <div className="w-5 h-5 rounded-full border border-white shadow-sm bg-gray-200 flex items-center justify-center text-gray-400 shrink-0">
          <UserIcon size={10} />
        </div>
      );
    }

    if (user.emoji) {
      return (
        <div className="w-5 h-5 rounded-full border border-white shadow-sm bg-violet-100 flex items-center justify-center text-xs shrink-0" role="img" aria-label="avatar">
          {user.emoji}
        </div>
      );
    }

    // Fallback if no emoji
    return (
      <div className="w-5 h-5 rounded-full border border-white shadow-sm bg-violet-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
        {user.name.charAt(0)}
      </div>
    );
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (isClickable && !isBlurred) {
          onClick(event);
        }
      }}
      className={`
        relative flex flex-col gap-1 mb-2 group transition-opacity
        ${isClickable && !isBlurred ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
        ${isBlurred ? 'opacity-70 grayscale' : ''}
      `}
    >
      {/* Sticky Note Icon - Always visible if note exists */}
      {event.note && !isBlurred && (
        <div className="absolute -top-1 -right-1 z-10 group/note">
          <div className="bg-yellow-100 border border-yellow-200 text-yellow-700 w-4 h-4 flex items-center justify-center rounded-full shadow-sm">
            <StickyNote size={10} />
          </div>
        </div>
      )}

      {priorityBadge && (
        <div className={`absolute -top-1 -left-1 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wide shadow-sm ${priorityBadge.className}`}>
          {PriorityIcon && <PriorityIcon size={9} />}
          <span>{priorityBadge.label}</span>
        </div>
      )}

      {/* Assigned User Info (Avatar + Name) */}
      <div className="flex items-center gap-1.5 px-1 min-w-0">
        {!isBlurred && renderAvatar()}
        <span className="text-[10px] text-gray-500 font-medium truncate leading-none">
          {isBlurred ? '🔒 Dolu' : (user ? `${user.name} ${monthlyBadges.trophy.includes(user.id) ? '🏆' : ''}${monthlyBadges.rocket.includes(user.id) ? '🚀' : ''}${monthlyBadges.power.includes(user.id) ? '💪' : ''}` : 'Atanmadı')}
        </span>
      </div>

      {/* The Colored Card */}
      <div className={`
        ${config.colorBg} 
        border-l-4 ${config.colorBorder} 
        rounded-r-md rounded-l-sm p-1.5 shadow-sm
        flex flex-col gap-0.5
        ${isBlurred ? 'blur-[3px] select-none' : ''}
        dark:bg-opacity-20 dark:border-opacity-60 dark:backdrop-blur-sm
      `}>
        <span className={`text-[9px] font-bold uppercase tracking-wide opacity-80 ${config.colorText} dark:text-gray-100`}>
          {isBlurred ? '---' : config.label}
        </span>
        <span className={`text-[11px] font-semibold leading-tight ${config.colorText} line-clamp-2 dark:text-white`}>
          {isBlurred ? 'Diğer Birim Kampanyası' : event.title}
        </span>
      </div>
    </div>
  );
};
