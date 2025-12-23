import React, { useMemo, useState } from 'react';
import {
    format,
    endOfMonth,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    isWeekend,
    startOfMonth,
    startOfWeek
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { AnalyticsTask, AnalyticsUser, CampaignStatus } from '../types';
import { DAYS_OF_WEEK, STATUS_STYLES } from '../constants';
import { Clock, AlertTriangle, CheckCircle2, Plus, BarChart3 } from 'lucide-react';

interface AnalyticsCalendarTabProps {
    currentDate: Date;
    tasks: AnalyticsTask[];
    users: AnalyticsUser[];
    onTaskClick: (task: AnalyticsTask) => void;
    onUpdateTaskDate: (taskId: string, newDate: Date) => Promise<void>;
    onDayClick?: (date: Date) => void;
    loggedInUserId?: string;
    isDesigner: boolean;
    isAnalitik: boolean;
}

export const AnalyticsCalendarTab: React.FC<AnalyticsCalendarTabProps> = ({
    currentDate,
    tasks,
    users,
    onTaskClick,
    onUpdateTaskDate,
    onDayClick,
    loggedInUserId,
    isDesigner,
    isAnalitik
}) => {
    const [draggedTask, setDraggedTask] = useState<AnalyticsTask | null>(null);

    // Filter tasks based on role
    const myTasks = useMemo(() => {
        if (isDesigner) return tasks;
        if (isAnalitik && loggedInUserId) {
            return tasks.filter(t => t.assigneeId === loggedInUserId);
        }
        return tasks;
    }, [tasks, isDesigner, isAnalitik, loggedInUserId]);

    // Stats
    const pendingTasks = myTasks.filter(t => t.status === 'Planlandı');
    const completedTasks = myTasks.filter(t => t.status === 'Tamamlandı');
    const cancelledTasks = myTasks.filter(t => t.status === 'İptal Edildi');

    // Calendar logic
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

        return eachDayOfInterval({
            start: startDate,
            end: endDate,
        });
    }, [currentDate]);

    const getTasksForDay = (date: Date) => {
        return myTasks.filter(task => isSameDay(task.date, date));
    };

    const getUserName = (userId?: string) => {
        if (!userId) return 'Atanmamış';
        return users.find(u => u.id === userId)?.name || 'Bilinmiyor';
    };

    const getUserEmoji = (userId?: string) => {
        if (!userId) return '👤';
        return users.find(u => u.id === userId)?.emoji || '👤';
    };

    const handleDayClick = (date: Date) => {
        if (isDesigner && onDayClick) {
            onDayClick(date);
        }
    };

    const handleTaskClick = (e: React.MouseEvent, task: AnalyticsTask) => {
        e.stopPropagation();
        onTaskClick(task);
    };

    const handleDragStart = (e: React.DragEvent, task: AnalyticsTask) => {
        if (!isDesigner) return;
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (isDesigner && draggedTask) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
        }
    };

    const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
        if (!isDesigner || !draggedTask) return;
        e.preventDefault();

        if (isSameDay(draggedTask.date, targetDate)) {
            setDraggedTask(null);
            return;
        }

        await onUpdateTaskDate(draggedTask.id, targetDate);
        setDraggedTask(null);
    };

    const canAddTask = isDesigner;

    // Get task card styling based on status
    const getTaskCardStyle = (task: AnalyticsTask) => {
        const status = task.status || 'Planlandı';
        switch (status) {
            case 'Tamamlandı':
                return 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700 hover:bg-emerald-100';
            case 'İptal Edildi':
                return 'bg-red-50 border-red-300 dark:bg-red-900/30 dark:border-red-700 hover:bg-red-100';
            default:
                return 'bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700 hover:bg-blue-100';
        }
    };

    const getStatusBadge = (task: AnalyticsTask) => {
        const status = task.status || 'Planlandı';
        switch (status) {
            case 'Tamamlandı':
                return { className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200', text: '✅' };
            case 'İptal Edildi':
                return { className: 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200', text: '❌' };
            default:
                return { className: 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200', text: '⏳' };
        }
    };

    return (
        <div className="space-y-4">
            {/* Stats Bar */}
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex-wrap">
                {/* Show label for Analitik role */}
                {isAnalitik && !isDesigner && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">📊 Senin İşlerin</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Clock className="text-blue-500" size={20} />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Bekleyen: <span className="text-blue-600 font-bold">{pendingTasks.length}</span>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-500" size={20} />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Tamamlandı: <span className="text-emerald-600 font-bold">{completedTasks.length}</span>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <AlertTriangle className="text-red-500" size={20} />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        İptal: <span className="text-red-600 font-bold">{cancelledTasks.length}</span>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <BarChart3 className="text-gray-500" size={20} />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Toplam: <span className="font-bold">{myTasks.length}</span>
                    </span>
                </div>
            </div>

            {/* Calendar Grid Header */}
            <div className="grid grid-cols-7 gap-4 mb-4">
                {DAYS_OF_WEEK.map(day => (
                    <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid Body */}
            <div className="grid grid-cols-7 gap-4 flex-1 content-start">
                {calendarDays.map((day) => {
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isTodayDate = isToday(day);
                    const isDayWeekend = isWeekend(day);
                    const dayTasks = getTasksForDay(day);

                    return (
                        <div
                            key={day.toString()}
                            onClick={() => handleDayClick(day)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, day)}
                            className={`
                                relative min-h-[140px] p-4 rounded-xl border-2 transition-all duration-200 group
                                flex flex-col
                                ${isCurrentMonth
                                    ? isDayWeekend
                                        ? 'bg-[#E2E8F0] dark:bg-[#0f172a] border-slate-400 dark:border-slate-700/50 shadow-md'
                                        : 'bg-white dark:bg-slate-800 border-zinc-300 dark:border-slate-600 shadow-sm hover:bg-blue-50 dark:hover:bg-slate-700 hover:border-blue-400'
                                    : 'bg-gray-200/50 dark:bg-slate-900/50 border-transparent opacity-40'}
                                ${isTodayDate ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 z-10' : 'border-solid'}
                                ${canAddTask ? 'cursor-pointer' : 'cursor-default'}
                            `}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div></div>
                                <span className={`
                                    text-xl font-normal w-10 h-10 flex items-center justify-center rounded-full leading-none
                                    ${isTodayDate
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                        : isDayWeekend && isCurrentMonth ? 'text-slate-500 dark:text-slate-400'
                                            : isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}
                                `}>
                                    {format(day, 'd')}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2">
                                {dayTasks.map(task => {
                                    const badge = getStatusBadge(task);

                                    return (
                                        <div
                                            key={task.id}
                                            draggable={isDesigner}
                                            onDragStart={(e) => handleDragStart(e, task)}
                                            onClick={(e) => handleTaskClick(e, task)}
                                            className={`
                                                p-2 rounded-lg border text-xs transition-all cursor-pointer hover:shadow-md
                                                ${getTaskCardStyle(task)}
                                                ${isDesigner ? 'active:cursor-grabbing' : ''}
                                            `}
                                        >
                                            <div className="flex items-center gap-1 mb-1">
                                                <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${badge.className}`}>
                                                    {badge.text}
                                                </span>
                                            </div>
                                            <div className="font-semibold text-gray-800 dark:text-white truncate">
                                                {task.title}
                                            </div>
                                            <div className="text-gray-500 dark:text-gray-400 text-[10px] mt-1">
                                                {getUserEmoji(task.assigneeId)} {getUserName(task.assigneeId)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Add Task Indicator for Designer */}
                            {canAddTask && (
                                <>
                                    <div className="absolute inset-0 bg-blue-50/0 group-hover:bg-blue-50/30 rounded-2xl pointer-events-none transition-colors" />
                                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-white p-1 rounded-full shadow-sm text-blue-500">
                                            <Plus size={14} />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AnalyticsCalendarTab;
