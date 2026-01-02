import React, { useRef, useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { GripVertical, RotateCcw } from 'lucide-react';
import { useWidgetPosition } from '../hooks/useWidgetPosition';

interface DraggableWidgetProps {
    widgetId: string;
    title: string;
    icon: string;
    children: React.ReactNode;
    headerClassName?: string;
}

export const DraggableWidget: React.FC<DraggableWidgetProps> = ({
    widgetId,
    title,
    icon,
    children,
    headerClassName = 'bg-black/10'
}) => {
    const { position, savePosition, resetPosition, isLoading } = useWidgetPosition(widgetId);
    const [isDragging, setIsDragging] = useState(false);
    const constraintsRef = useRef<HTMLDivElement>(null);

    const isFloating = position !== null;

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (!position) {
            // First drag - calculate initial position from current element position
            const element = document.getElementById(`widget-${widgetId}`);
            if (element) {
                const rect = element.getBoundingClientRect();
                savePosition({
                    x: rect.left + info.offset.x,
                    y: rect.top + info.offset.y
                });
            }
        } else {
            // Already floating - update position with offset
            savePosition({
                x: position.x + info.offset.x,
                y: position.y + info.offset.y
            });
        }
        setIsDragging(false);
    };

    const handleDragStart = () => {
        setIsDragging(true);
    };

    // Calculate position ensuring widget stays in viewport
    const getConstrainedPosition = () => {
        if (!position) return undefined;

        const maxX = typeof window !== 'undefined' ? window.innerWidth - 300 : 1000;
        const maxY = typeof window !== 'undefined' ? window.innerHeight - 100 : 800;

        return {
            x: Math.max(0, Math.min(position.x, maxX)),
            y: Math.max(0, Math.min(position.y, maxY))
        };
    };

    const constrainedPosition = getConstrainedPosition();

    if (isLoading) {
        return <div className="animate-pulse bg-gray-200 dark:bg-slate-700 rounded-2xl h-32" />;
    }

    return (
        <>
            {/* Viewport constraints reference */}
            <div
                ref={constraintsRef}
                className="fixed inset-0 pointer-events-none"
                style={{ zIndex: -1 }}
            />

            <motion.div
                id={`widget-${widgetId}`}
                drag
                dragMomentum={false}
                dragElastic={0}
                dragConstraints={{
                    top: 0,
                    left: 0,
                    right: typeof window !== 'undefined' ? window.innerWidth - 300 : 1000,
                    bottom: typeof window !== 'undefined' ? window.innerHeight - 100 : 800
                }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                whileDrag={{
                    zIndex: 999,
                    scale: 1.02,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
                style={isFloating ? {
                    position: 'fixed',
                    left: constrainedPosition?.x,
                    top: constrainedPosition?.y,
                    width: 288,
                    zIndex: isDragging ? 999 : 50
                } : {
                    position: 'relative',
                    width: '100%'
                }}
                className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
            >
                <div className="rounded-2xl shadow-xl overflow-hidden">
                    {/* Drag handle header - only shown when floating */}
                    {isFloating && (
                        <div className={`px-3 py-1.5 flex items-center justify-between ${headerClassName}`}>
                            <div className="flex items-center gap-2 text-white/90">
                                <GripVertical size={14} className="opacity-70" />
                                <span className="text-xs font-medium">{icon} {title}</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    resetPosition();
                                }}
                                className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                                title="Varsayılan konuma döndür"
                            >
                                <RotateCcw size={12} />
                            </button>
                        </div>
                    )}

                    {/* Widget content */}
                    {children}
                </div>
            </motion.div>
        </>
    );
};

export default DraggableWidget;
