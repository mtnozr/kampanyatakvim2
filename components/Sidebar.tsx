import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Settings, Eye, EyeOff } from 'lucide-react';
import { WeatherWidget } from './WeatherWidget';
import { StickyNoteWidget } from './StickyNoteWidget';
import { PhoneDirectory } from './PhoneDirectory';
import { User, AnalyticsUser } from '../types';

interface SidebarProps {
    users: User[];
    analyticsUsers: AnalyticsUser[];
}

interface WidgetConfig {
    id: string;
    name: string;
    icon: string;
    visible: boolean;
}

const STORAGE_KEY = 'kampanya_takvim_sidebar_config';

const defaultWidgets: WidgetConfig[] = [
    { id: 'weather', name: 'Hava Durumu', icon: '🌤️', visible: true },
    { id: 'notes', name: 'Hızlı Not', icon: '📝', visible: true },
    { id: 'phone', name: 'Telefon Rehberi', icon: '📞', visible: true },
];

export const Sidebar: React.FC<SidebarProps> = ({ users, analyticsUsers }) => {
    const [widgets, setWidgets] = useState<WidgetConfig[]>(defaultWidgets);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with defaults (in case new widgets are added)
                const merged = defaultWidgets.map(dw => {
                    const savedWidget = parsed.find((sw: WidgetConfig) => sw.id === dw.id);
                    return savedWidget ? { ...dw, visible: savedWidget.visible } : dw;
                });
                setWidgets(merged);
            } catch {
                console.error('Failed to parse sidebar config');
            }
        }
    }, []);

    // Save to localStorage
    const saveConfig = (newWidgets: WidgetConfig[]) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newWidgets));
        setWidgets(newWidgets);
    };

    const toggleWidget = (id: string) => {
        const updated = widgets.map(w =>
            w.id === id ? { ...w, visible: !w.visible } : w
        );
        saveConfig(updated);
    };

    const isVisible = (id: string) => widgets.find(w => w.id === id)?.visible ?? true;
    const visibleCount = widgets.filter(w => w.visible).length;

    return (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-30 w-72 flex flex-col gap-2">
            {/* Settings Toggle */}
            <div className="flex justify-end mb-1">
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${isSettingsOpen
                            ? 'bg-violet-500 text-white shadow-lg'
                            : 'bg-white/80 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 shadow-sm'
                        }`}
                    title="Widget Ayarları"
                >
                    <Settings size={14} className={isSettingsOpen ? 'animate-spin' : ''} />
                    <span>{visibleCount}/{widgets.length}</span>
                </button>
            </div>

            {/* Settings Panel */}
            {isSettingsOpen && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Widget Görünürlüğü</p>
                    <div className="space-y-1.5">
                        {widgets.map(widget => (
                            <button
                                key={widget.id}
                                onClick={() => toggleWidget(widget.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${widget.visible
                                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                        : 'bg-gray-50 dark:bg-slate-700 text-gray-400 dark:text-gray-500'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span>{widget.icon}</span>
                                    <span className="font-medium">{widget.name}</span>
                                </div>
                                {widget.visible ? (
                                    <Eye size={16} className="text-green-600 dark:text-green-400" />
                                ) : (
                                    <EyeOff size={16} className="text-gray-400" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Widgets */}
            <div className="flex flex-col gap-3">
                {isVisible('weather') && <WeatherWidget />}
                {isVisible('notes') && <StickyNoteWidget />}
                {isVisible('phone') && <PhoneDirectory users={users} analyticsUsers={analyticsUsers} />}
            </div>
        </div>
    );
};

export default Sidebar;
