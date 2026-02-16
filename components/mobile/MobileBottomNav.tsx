import React from 'react';
import { CalendarDays, FileText, BarChart3, CheckSquare, MoreHorizontal } from 'lucide-react';

export type MobileTabKey = 'kampanya' | 'rapor' | 'analitik' | 'islerim' | 'diger';

interface MobileBottomNavProps {
  activeTab: MobileTabKey;
  onChangeTab: (tab: MobileTabKey) => void;
  canSeeKampanyaTab: boolean;
  canSeeReportTab: boolean;
  canSeeAnalyticsTab: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onChangeTab,
  canSeeKampanyaTab,
  canSeeReportTab,
  canSeeAnalyticsTab,
}) => {
  const items = [
    canSeeKampanyaTab ? { key: 'kampanya' as MobileTabKey, label: 'Kampanya', icon: CalendarDays } : null,
    canSeeReportTab ? { key: 'rapor' as MobileTabKey, label: 'Rapor', icon: FileText } : null,
    canSeeAnalyticsTab ? { key: 'analitik' as MobileTabKey, label: 'Analitik', icon: BarChart3 } : null,
    { key: 'islerim' as MobileTabKey, label: 'İşlerim', icon: CheckSquare },
    { key: 'diger' as MobileTabKey, label: 'Diğer', icon: MoreHorizontal },
  ].filter(Boolean) as Array<{ key: MobileTabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }>;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChangeTab(item.key)}
              className={`flex flex-col items-center justify-center py-2 text-[11px] font-medium transition-all duration-200 active:scale-90 ${
                isActive ? 'text-violet-600 dark:text-violet-300' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <div className={`relative flex items-center justify-center transition-all duration-200 ${
                isActive ? 'scale-110' : ''
              }`}>
                {isActive && (
                  <div className="absolute inset-0 -mx-3 -my-1 rounded-full bg-violet-100 dark:bg-violet-900/40" />
                )}
                <Icon size={20} className="relative z-10" />
              </div>
              <span className={`mt-1 transition-all duration-200 ${
                isActive ? 'font-bold text-[11px]' : 'font-medium text-[11px]'
              }`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileBottomNav;
