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
    startOfWeek,
    isBefore
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Report, User, Department } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { CheckCircle2, Clock, AlertTriangle, FileText, Plus } from 'lucide-react';

interface ReportCalendarTabProps {
    currentDate: Date;
    reports: Report[];
    users: User[];
    departments: Department[];
    onMarkReportDone: (reportId: string) => Promise<void>;
    onUpdateReportDueDate: (reportId: string, newDate: Date) => Promise<void>;
    onDayClick?: (date: Date) => void;
    loggedInUserId?: string;
    isDesigner: boolean;
    isKampanyaYapan: boolean;
}

export const ReportCalendarTab: React.FC<ReportCalendarTabProps> = ({
    currentDate,
    reports,
    users,
    departments,
    onMarkReportDone,
    onUpdateReportDueDate,
    onDayClick,
    loggedInUserId,
    isDesigner,
    isKampanyaYapan
}) => {
    const now = new Date();
    const [draggedReport, setDraggedReport] = useState<Report | null>(null);

    // Filter to only pending reports and calculate overdue status
    const pendingReports = useMemo(() => {
        return reports
            .filter(r => r.status === 'pending')
            .map(r => ({
                ...r,
                isOverdue: isBefore(r.dueDate, now)
            }));
    }, [reports, now]);

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

    // Get reports due on a specific day
    const getReportsForDay = (date: Date) => {
        return pendingReports.filter(report => isSameDay(report.dueDate, date));
    };

    // Stats
    const overdueCount = pendingReports.filter(r => r.isOverdue).length;
    const pendingCount = pendingReports.filter(r => !r.isOverdue).length;

    const handleMarkDone = async (reportId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await onMarkReportDone(reportId);
    };

    const getUserName = (userId?: string) => {
        if (!userId) return 'Atanmamış';
        return users.find(u => u.id === userId)?.name || 'Bilinmiyor';
    };

    const handleDayClick = (date: Date) => {
        if (isDesigner && onDayClick) {
            onDayClick(date);
        }
    };

    const handleDragStart = (e: React.DragEvent, report: Report & { isOverdue: boolean }) => {
        if (!isDesigner) return;
        setDraggedReport(report);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", report.id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (isDesigner && draggedReport) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
        }
    };

    const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
        if (!isDesigner || !draggedReport) return;
        e.preventDefault();

        // Don't do anything if dropped on the same day
        if (isSameDay(draggedReport.dueDate, targetDate)) {
            setDraggedReport(null);
            return;
        }

        await onUpdateReportDueDate(draggedReport.id, targetDate);
        setDraggedReport(null);
    };

    const canAddReport = isDesigner;

    return (
        <div className="space-y-4">
            {/* Stats Bar */}
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2">
                    <Clock className="text-amber-500" size={20} />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Bekleyen: <span className="text-amber-600 font-bold">{pendingCount}</span>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <AlertTriangle className="text-red-500" size={20} />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Gecikmiş: <span className="text-red-600 font-bold">{overdueCount}</span>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <FileText className="text-gray-500" size={20} />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Toplam: <span className="font-bold">{pendingReports.length}</span>
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
                    const dayReports = getReportsForDay(day);

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
                                        : 'bg-white dark:bg-slate-800 border-zinc-300 dark:border-slate-600 shadow-sm hover:bg-emerald-50 dark:hover:bg-slate-700 hover:border-emerald-400'
                                    : 'bg-gray-200/50 dark:bg-slate-900/50 border-transparent opacity-40'}
                ${isTodayDate ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 z-10' : 'border-solid'}
                ${canAddReport ? 'cursor-pointer' : 'cursor-default'}
              `}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div></div>
                                <span className={`
                  text-xl font-normal w-10 h-10 flex items-center justify-center rounded-full leading-none
                  ${isTodayDate
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                                        : isDayWeekend && isCurrentMonth ? 'text-slate-500 dark:text-slate-400'
                                            : isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}
                `}>
                                    {format(day, 'd')}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2">
                                {dayReports.map(report => {
                                    const canMarkDone = isDesigner || isKampanyaYapan ||
                                        (loggedInUserId && report.assigneeId === loggedInUserId);

                                    return (
                                        <div
                                            key={report.id}
                                            draggable={isDesigner}
                                            onDragStart={(e) => handleDragStart(e, report)}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`
                        p-2 rounded-lg border text-xs transition-all
                        ${report.isOverdue
                                                    ? 'bg-red-50 border-red-300 dark:bg-red-900/30 dark:border-red-700'
                                                    : 'bg-amber-50 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700'}
                        ${isDesigner ? 'cursor-grab active:cursor-grabbing' : ''}
                      `}
                                        >
                                            <div className="font-semibold text-gray-800 dark:text-white truncate mb-1">
                                                {report.title}
                                            </div>
                                            <div className="text-gray-500 dark:text-gray-400 text-[10px] mb-1">
                                                📊 {getUserName(report.assigneeId)}
                                            </div>
                                            {report.campaignTitle && (
                                                <div className="text-gray-400 dark:text-gray-500 text-[10px] mb-1 truncate">
                                                    🎯 {report.campaignTitle}
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between gap-1">
                                                <span className={`
                          px-1.5 py-0.5 rounded text-[10px] font-medium
                          ${report.isOverdue
                                                        ? 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200'
                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-200'}
                        `}>
                                                    {report.isOverdue ? '⚠️ Gecikmiş' : '⏳ Bekliyor'}
                                                </span>
                                                {canMarkDone && (
                                                    <button
                                                        onClick={(e) => handleMarkDone(report.id, e)}
                                                        className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded text-[10px] font-medium transition-colors dark:bg-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-700"
                                                        title="Raporu Tamamla"
                                                    >
                                                        <CheckCircle2 size={10} />
                                                        Tamamla
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Add Report Indicator for Designer */}
                            {canAddReport && (
                                <>
                                    <div className="absolute inset-0 bg-emerald-50/0 group-hover:bg-emerald-50/30 rounded-2xl pointer-events-none transition-colors" />
                                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-white p-1 rounded-full shadow-sm text-emerald-500">
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

export default ReportCalendarTab;
