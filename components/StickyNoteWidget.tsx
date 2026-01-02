import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Save, Trash2, GripVertical, RotateCcw } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

const STORAGE_KEY = 'kampanya_takvim_sticky_note';

export const StickyNoteWidget: React.FC = () => {
    const [note, setNote] = useState('');
    const [isSaved, setIsSaved] = useState(true);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        widgetHeight: 200
    });

    // Load from localStorage on mount
    useEffect(() => {
        const savedNote = localStorage.getItem(STORAGE_KEY);
        if (savedNote) {
            try {
                const parsed = JSON.parse(savedNote);
                setNote(parsed.content || '');
                if (parsed.savedAt) {
                    setLastSaved(new Date(parsed.savedAt));
                }
            } catch {
                setNote(savedNote);
            }
        }
    }, []);

    // Auto-save with debounce
    useEffect(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        if (!isSaved) {
            saveTimeoutRef.current = setTimeout(() => {
                saveNote();
            }, 1000);
        }

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [note, isSaved]);

    const saveNote = () => {
        const now = new Date();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            content: note,
            savedAt: now.toISOString()
        }));
        setLastSaved(now);
        setIsSaved(true);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNote(e.target.value);
        setIsSaved(false);
    };

    const handleClear = () => {
        if (window.confirm('Notu silmek istediğinize emin misiniz?')) {
            setNote('');
            localStorage.removeItem(STORAGE_KEY);
            setLastSaved(null);
            setIsSaved(true);
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [note]);

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
            <div className={`bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl shadow-xl overflow-hidden ${isDragging ? 'shadow-2xl scale-[1.02]' : ''} transition-shadow`}>
                {/* Header with drag handle */}
                <div className="flex items-stretch bg-amber-500/30">
                    {/* Drag Handle */}
                    <div
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        className="px-2 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-amber-600/20 transition-colors border-r border-amber-600/20"
                        title="Sürükle"
                    >
                        <GripVertical size={16} className="text-amber-900/50" />
                    </div>

                    {/* Header Content */}
                    <div className="flex-1 px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <StickyNote size={14} className="text-amber-900/70" />
                            <span className="text-xs font-bold text-amber-900/80">Hızlı Not Al</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {!isSaved && (
                                <span className="text-[10px] text-amber-800/60 italic">kaydediliyor...</span>
                            )}
                            {position && (
                                <button
                                    onClick={resetPosition}
                                    className="p-1 text-amber-900/50 hover:text-amber-900 hover:bg-amber-600/20 rounded transition-colors"
                                    title="Konumu Sıfırla"
                                >
                                    <RotateCcw size={12} />
                                </button>
                            )}
                            {note && (
                                <button
                                    onClick={handleClear}
                                    className="p-1 text-amber-900/50 hover:text-red-600 hover:bg-red-100/50 rounded transition-colors"
                                    title="Notu Sil"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-2">
                    <textarea
                        ref={textareaRef}
                        value={note}
                        onChange={handleChange}
                        placeholder="Notunuzu buraya yazın..."
                        className="w-full min-h-[60px] max-h-[200px] px-3 py-2 text-sm bg-amber-50/80 dark:bg-amber-100/90 text-amber-900 placeholder-amber-600/50 rounded-xl border-0 resize-none focus:ring-2 focus:ring-amber-600/30 focus:outline-none transition-all font-handwriting"
                        style={{ fontFamily: "'Caveat', 'Comic Sans MS', cursive" }}
                    />
                </div>

                {/* Footer - Last saved */}
                {lastSaved && (
                    <div className="px-3 pb-2 bg-amber-500/20">
                        <p className="text-[10px] text-amber-900/70 text-center flex items-center justify-center gap-1 font-medium">
                            <Save size={10} className="text-green-700" />
                            <span>Kaydedildi:</span>
                            <span className="font-bold">{lastSaved.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StickyNoteWidget;

