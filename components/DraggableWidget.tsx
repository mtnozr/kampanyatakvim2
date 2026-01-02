import React from 'react';
import { GripVertical, RotateCcw } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

interface DraggableWidgetProps {
    widgetId: string;
    title: string;
    children: React.ReactNode;
    defaultWidth?: number;
    defaultHeight?: number;
}

export const DraggableWidget: React.FC<DraggableWidgetProps> = ({
    widgetId,
    title,
    children,
    defaultWidth = 288,
    defaultHeight = 200
}) => {
    const {
        position,
        isDragging,
        zIndex,
        handleMouseDown,
        handleTouchStart,
        bringToFront,
        resetPosition,
        containerRef
    } = useDraggable({
        storageKey: widgetId,
        containerWidth: defaultWidth,
        containerHeight: defaultHeight
    });

    // Determine if widget is in dragged/fixed mode
    const isFloating = position !== null;

    const containerStyle: React.CSSProperties = isFloating
        ? {
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: zIndex,
            width: defaultWidth
        }
        : {
            position: 'relative',
            width: '100%'
        };

    return (
        <div
            ref={containerRef}
            style={containerStyle}
            className={`transition-shadow duration-200 ${isDragging ? 'shadow-2xl scale-[1.02]' : ''}`}
            onMouseDown={bringToFront}
        >
            {/* Floating mode drag handle bar */}
            {isFloating && (
                <div
                    className={`flex items-center justify-between px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded-t-xl border-b border-gray-200 dark:border-slate-600 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                >
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                        <GripVertical size={14} />
                        <span className="text-xs font-medium">{title}</span>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            resetPosition();
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-colors"
                        title="Varsayılan konuma döndür"
                    >
                        <RotateCcw size={12} />
                    </button>
                </div>
            )}

            {/* Static mode - add small drag handle */}
            {!isFloating && (
                <div
                    className={`absolute -top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 bg-violet-500 hover:bg-violet-600 text-white rounded-full text-xs font-medium shadow-lg hover:shadow-xl transition-all z-10 ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-105'}`}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    title="Sürükleyerek taşı"
                >
                    <GripVertical size={12} />
                    <span>Taşı</span>
                </div>
            )}

            {/* Widget content */}
            <div className={isFloating ? 'rounded-b-2xl overflow-hidden' : ''}>
                {children}
            </div>
        </div>
    );
};

export default DraggableWidget;
