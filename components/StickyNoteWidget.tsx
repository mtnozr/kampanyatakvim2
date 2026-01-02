import React, { useState, useEffect } from 'react';
import { PenLine, Save, Trash2, GripVertical, RotateCcw } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

export const StickyNoteWidget: React.FC = () => {
    const [note, setNote] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const {
        position,
        isDragging,
        handleMouseDown,
        handleTouchStart,
        containerRef,
        resetPosition
    } = useDraggable({
        storageKey: 'kampanya_takvim_sticky_note_position',
        widgetWidth: 288,
        widgetHeight: 200 // Approximate height
    });

    useEffect(() => {
        const savedNote = localStorage.getItem('kampanya_takvim_quick_note');
        if (savedNote) setNote(savedNote);
    }, []);

    const handleSave = () => {
        localStorage.setItem('kampanya_takvim_quick_note', note);
        setIsEditing(false);
    };

    const handleClear = () => {
        setNote('');
        localStorage.removeItem('kampanya_takvim_quick_note');
        setIsEditing(false);
    };

    // Calculate position style
    const positionStyle: React.CSSProperties = position
        ? { position: 'fixed', left: position.x, top: position.y, zIndex: 50, width: 288 }
        : {};

    return (
        <div
            ref={containerRef}
            className={`${position ? '' : 'w-full'} ${isDragging ? 'cursor-grabbing' : ''}`}
            style={positionStyle}
        >
            <div className={`bg-gradient-to-br from-amber-200 to-yellow-400 dark:from-amber-600 dark:to-yellow-700 rounded-2xl shadow-xl overflow-hidden ${isDragging ? 'shadow-2xl scale-[1.02]' : ''} transition-all`}>
                {/* Header with drag handle */}
                <div className="flex items-stretch bg-white/20">
                    {/* Drag Handle */}
                    <div
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        className="px-2 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors border-r border-black/5 dark:border-white/10 touch-none"
                        title="Sürükle"
                    >
                        <GripVertical size={16} className="text-amber-900/50 dark:text-amber-100/50" />
                    </div>

                    {/* Header Content */}
                    <div className="flex-1 px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-50">
                            <PenLine size={14} className="opacity-80" />
                            <span className="text-xs font-bold">Hızlı Not</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {position && (
                                <button
                                    onClick={resetPosition}
                                    className="p-1 text-amber-900/60 dark:text-amber-100/60 hover:text-amber-900 dark:hover:text-amber-50 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                                    title="Konumu Sıfırla"
                                >
                                    <RotateCcw size={12} />
                                </button>
                            )}
                            <button
                                onClick={handleClear}
                                className="p-1 text-amber-900/60 dark:text-amber-100/60 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Notu Sil"
                            >
                                <Trash2 size={12} />
                            </button>
                            <button
                                onClick={handleSave}
                                className={`p-1 rounded-lg transition-colors ${isEditing
                                    ? 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 font-medium'
                                    : 'text-amber-900/60 dark:text-amber-100/60 hover:text-amber-900 dark:hover:text-amber-50 hover:bg-black/5 dark:hover:bg-white/10'
                                    }`}
                                title={isEditing ? "Kaydet" : "Kaydedildi"}
                            >
                                <Save size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-3">
                    <textarea
                        value={note}
                        onChange={(e) => {
                            setNote(e.target.value);
                            setIsEditing(true);
                        }}
                        placeholder="Buraya not alabilirsiniz..."
                        className="w-full h-24 bg-white/40 dark:bg-black/20 text-amber-900 dark:text-amber-50 placeholder-amber-900/40 dark:placeholder-amber-100/40 text-sm rounded-xl p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-shadow custom-scrollbar"
                    />
                </div>

                {/* Last saved footer removed to match previous design preference or keep irrelevant code out */}
            </div>
        </div>
    );
};

export default StickyNoteWidget;
