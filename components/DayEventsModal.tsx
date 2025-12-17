import React from 'react';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { EventBadge } from './EventBadge';
import { CalendarEvent, DepartmentUser, User } from '../types';

interface DayEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  events: CalendarEvent[];
  users: User[];
  currentDepartmentId: string | null;
  loggedInDeptUser: DepartmentUser | null;
  isDesigner: boolean;
  isKampanyaYapan: boolean;
  monthlyChampionId: string | null;
  onEventClick: (eventId: string) => void;
  onNoteClick: (eventId: string, note: string) => void;
}

export default function DayEventsModal({
  isOpen,
  onClose,
  date,
  events,
  users,
  currentDepartmentId,
  loggedInDeptUser,
  isDesigner,
  isKampanyaYapan,
  monthlyChampionId,
  onEventClick,
  onNoteClick
}: DayEventsModalProps) {
  if (!isOpen || !date) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {format(date, 'd MMMM yyyy, EEEE', { locale: tr })}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {events.length} Kampanya
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {events.map(event => {
            const isMyDeptInfo = currentDepartmentId && event.departmentId === currentDepartmentId;
            let isBlurred = false;
            let isClickable = false;

            if (isDesigner) {
              isBlurred = false;
              isClickable = true;
            } else if (isKampanyaYapan) {
              isBlurred = false;
              isClickable = true;
            } else if (loggedInDeptUser) {
              if (isMyDeptInfo) {
                isBlurred = false;
                isClickable = false;
              } else {
                isBlurred = true;
                isClickable = false;
              }
            } else {
              isBlurred = true;
              isClickable = false;
            }

            return (
              <div 
                key={event.id}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (loggedInDeptUser || isDesigner || isKampanyaYapan) {
                        onNoteClick(event.id, event.note || '');
                    }
                }}
              >
                <EventBadge
                  event={event}
                  user={users.find(u => u.id === event.assigneeId)}
                  onClick={(e) => onEventClick(e.id)}
                  isBlurred={isBlurred}
                  isClickable={isClickable}
                  monthlyChampionId={monthlyChampionId}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
