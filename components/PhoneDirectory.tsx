import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Phone, Book, Search, X, GripVertical } from 'lucide-react';
import { User, AnalyticsUser } from '../types';

interface PhoneDirectoryProps {
    users: User[];
    analyticsUsers: AnalyticsUser[];
}

interface Position {
    x: number;
    y: number;
}

export const PhoneDirectory: React.FC<PhoneDirectoryProps> = ({ users, analyticsUsers }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [position, setPosition] = useState<Position | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);

    // Click outside to close (but not while dragging)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isDragging) return;
            if (isExpanded && containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isExpanded, isDragging]);

    // Drag handlers
    const handleDragStart = useCallback((clientX: number, clientY: number) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        setDragOffset({
            x: clientX - rect.left,
            y: clientY - rect.top
        });
        setIsDragging(true);
    }, []);

    const handleDragMove = useCallback((clientX: number, clientY: number) => {
        if (!isDragging) return;

        const newX = clientX - dragOffset.x;
        const newY = clientY - dragOffset.y;

        // Keep within viewport bounds
        const maxX = window.innerWidth - 288; // 72 * 4 = 288 (w-72)
        const maxY = window.innerHeight - 100;

        setPosition({
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
        });
    }, [isDragging, dragOffset]);

    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
        const handleMouseUp = () => handleDragEnd();

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    // Touch events
    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        handleDragStart(touch.clientX, touch.clientY);
    };

    const handleTouchMove = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        handleDragMove(touch.clientX, touch.clientY);
    }, [handleDragMove]);

    const handleTouchEnd = useCallback(() => {
        handleDragEnd();
    }, [handleDragEnd]);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, handleTouchMove, handleTouchEnd]);

    // Combine and sort all personnel alphabetically
    const allPersonnel = useMemo(() => [
        ...users.map(u => ({ id: u.id, name: u.name, phone: u.phone, type: 'kampanya' as const, emoji: u.emoji })),
        ...analyticsUsers.map(u => ({ id: u.id, name: u.name, phone: u.phone, type: 'analitik' as const, emoji: u.emoji }))
    ].sort((a, b) => a.name.localeCompare(b.name, 'tr')), [users, analyticsUsers]);

    // Filter personnel with phone numbers
    const personnelWithPhone = useMemo(() =>
        allPersonnel.filter(p => p.phone),
        [allPersonnel]
    );

    // Filter by search query (name or phone) - Turkish locale for proper İ/i handling
    const filteredPersonnel = useMemo(() => {
        if (!searchQuery.trim()) return personnelWithPhone;

        const query = searchQuery.toLocaleLowerCase('tr').trim();
        return personnelWithPhone.filter(p =>
            p.name.toLocaleLowerCase('tr').includes(query) ||
            p.phone?.includes(query)
        );
    }, [personnelWithPhone, searchQuery]);

    // Helper function to get phone link (Jabber SIP)
    const getPhoneLink = (phone: string) => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            let mobilePhone = phone;
            if (phone.startsWith('9')) {
                mobilePhone = '0216' + phone.substring(1);
            }
            return `tel:${mobilePhone}`;
        }
        return `sip:${phone}`;
    };

    // Helper function to format phone for display
    const getDisplayPhone = (phone: string) => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile && phone.startsWith('9')) {
            return '0216' + phone.substring(1);
        }
        return phone;
    };

    // Highlight matching text in search results
    const highlightMatch = (text: string, query: string) => {
        if (!query.trim()) return text;

        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, i) =>
            regex.test(part) ? (
                <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 text-inherit rounded px-0.5">
                    {part}
                </mark>
            ) : part
        );
    };

    if (personnelWithPhone.length === 0) return null;

    // Calculate position style
    const positionStyle = position
        ? { left: position.x, top: position.y, transform: 'none' }
        : { right: 16, top: '50%', transform: 'translateY(-50%)' };

    return (
        <div
            ref={containerRef}
            className={`fixed z-30 w-72 ${isDragging ? 'cursor-grabbing' : ''}`}
            style={positionStyle}
        >
            <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden transition-all duration-300 ${isDragging ? 'shadow-3xl scale-[1.02]' : ''}`}>
                {/* Header with drag handle */}
                <div className="flex items-stretch bg-gradient-to-r from-teal-500 to-cyan-500">
                    {/* Drag Handle */}
                    <div
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        className="px-2 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors border-r border-white/20"
                        title="Sürükle"
                    >
                        <GripVertical size={16} className="text-white/70" />
                    </div>

                    {/* Toggle Button */}
                    <button
                        onClick={() => {
                            setIsExpanded(!isExpanded);
                            if (!isExpanded) setSearchQuery('');
                        }}
                        className="flex-1 px-3 py-3.5 flex items-center justify-between text-white hover:bg-white/10 transition-all group"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                                <Book size={16} />
                            </div>
                            <div className="text-left">
                                <span className="font-bold text-sm block">Telefon Rehberi</span>
                                <span className="text-[10px] opacity-80">{personnelWithPhone.length} kişi</span>
                            </div>
                        </div>
                        <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown size={20} />
                        </div>
                    </button>
                </div>

                {/* Expandable Content */}
                <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                    {/* Search Input */}
                    <div className="p-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="İsim veya numara ara..."
                                className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        {searchQuery && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 pl-1">
                                {filteredPersonnel.length} sonuç bulundu
                            </p>
                        )}
                    </div>

                    {/* Personnel List */}
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {filteredPersonnel.length === 0 ? (
                            <div className="p-6 text-center">
                                <div className="text-gray-400 dark:text-gray-500 mb-2">
                                    <Search size={32} className="mx-auto opacity-50" />
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Sonuç bulunamadı</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Farklı bir arama deneyin</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                {filteredPersonnel.map(person => (
                                    <div
                                        key={`${person.type}-${person.id}`}
                                        className="px-4 py-3 flex items-center justify-between hover:bg-teal-50/50 dark:hover:bg-teal-900/10 transition-colors group/item"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-lg shrink-0 shadow-inner">
                                                {person.emoji || '👤'}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                                    {highlightMatch(person.name, searchQuery)}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                    {highlightMatch(getDisplayPhone(person.phone!), searchQuery)}
                                                </p>
                                            </div>
                                        </div>
                                        <a
                                            href={getPhoneLink(person.phone!)}
                                            className="shrink-0 p-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 active:scale-95 shadow-md hover:shadow-lg transition-all group-hover/item:scale-105"
                                            title={`${person.name} ara`}
                                        >
                                            <Phone size={16} />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer hint */}
                    <div className="px-4 py-2 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                            📞 Tıklayarak Jabber ile arayın
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PhoneDirectory;
