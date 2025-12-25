import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Phone, Book } from 'lucide-react';
import { User, AnalyticsUser } from '../types';

interface PhoneDirectoryProps {
    users: User[];
    analyticsUsers: AnalyticsUser[];
}

export const PhoneDirectory: React.FC<PhoneDirectoryProps> = ({ users, analyticsUsers }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Combine and sort all personnel alphabetically
    const allPersonnel = [
        ...users.map(u => ({ id: u.id, name: u.name, phone: u.phone, type: 'kampanya' as const, emoji: u.emoji })),
        ...analyticsUsers.map(u => ({ id: u.id, name: u.name, phone: u.phone, type: 'analitik' as const, emoji: u.emoji }))
    ].sort((a, b) => a.name.localeCompare(b.name, 'tr'));

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

    const personnelWithPhone = allPersonnel.filter(p => p.phone);

    if (personnelWithPhone.length === 0) return null;

    return (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-30 w-64">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                {/* Header - Click to toggle */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 transition-all"
                >
                    <div className="flex items-center gap-2">
                        <Book size={18} />
                        <span className="font-bold text-sm">Telefon Rehberi</span>
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                            {personnelWithPhone.length}
                        </span>
                    </div>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {/* Expandable Content */}
                {isExpanded && (
                    <div className="max-h-96 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                        <div className="divide-y divide-gray-100 dark:divide-slate-700">
                            {personnelWithPhone.map(person => (
                                <div
                                    key={`${person.type}-${person.id}`}
                                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-lg shrink-0">{person.emoji || '👤'}</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                                {person.name}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {getDisplayPhone(person.phone!)}
                                            </p>
                                        </div>
                                    </div>
                                    <a
                                        href={getPhoneLink(person.phone!)}
                                        className="shrink-0 p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors"
                                        title="Ara"
                                    >
                                        <Phone size={16} />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PhoneDirectory;
