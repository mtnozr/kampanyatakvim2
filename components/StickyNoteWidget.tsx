import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Save, Trash2, GripHorizontal, RotateCcw, X } from 'lucide-react';

const STORAGE_KEY = 'kampanya_takvim_sticky_note';
const POSITION_KEY = 'sticky_note_widget_position';

interface StickyNoteWidgetProps {
    isFloating?: boolean;
    onClose?: () => void;
}

export const StickyNoteWidget: React.FC<StickyNoteWidgetProps> = ({ isFloating = false, onClose }) => {
    const [note, setNote] = useState('');
    const [isSaved, setIsSaved] = useState(true);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Drag state - using refs to avoid re-renders during drag
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const currentPos = useRef({ x: 0, y: 0 });

    // Load position on mount (only for floating mode)
    useEffect(() => {
        if (isFloating && containerRef.current) {
            const saved = localStorage.getItem(POSITION_KEY);
            if (saved) {
                try {
                    const pos = JSON.parse(saved);
                    currentPos.current = pos;
                    containerRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
                } catch {
                    // Use default position
                }
            }
        }
    }, [isFloating]);

    // Drag event handlers (only for floating mode)
    useEffect(() => {
        if (!isFloating) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !containerRef.current) return;

            const deltaX = e.clientX - dragStart.current.x;
            const deltaY = e.clientY - dragStart.current.y;

            const newX = currentPos.current.x + deltaX;
            const newY = currentPos.current.y + deltaY;

            containerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        };

        const handleMouseUp = () => {
            if (!isDragging.current || !containerRef.current) return;

            isDragging.current = false;
            containerRef.current.style.cursor = '';

            // Get final position from transform
            const style = containerRef.current.style.transform;
            const match = style.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
            if (match) {
                currentPos.current = { x: parseFloat(match[1]), y: parseFloat(match[2]) };
                localStorage.setItem(POSITION_KEY, JSON.stringify(currentPos.current));
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging.current || !containerRef.current) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - dragStart.current.x;
            const deltaY = touch.clientY - dragStart.current.y;

            const newX = currentPos.current.x + deltaX;
            const newY = currentPos.current.y + deltaY;

            containerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        };

        const handleTouchEnd = () => {
            if (!isDragging.current || !containerRef.current) return;

            isDragging.current = false;

            // Get final position from transform
            const style = containerRef.current.style.transform;
            const match = style.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
            if (match) {
                currentPos.current = { x: parseFloat(match[1]), y: parseFloat(match[2]) };
                localStorage.setItem(POSITION_KEY, JSON.stringify(currentPos.current));
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isFloating]);

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isFloating) return;

        e.preventDefault();
        isDragging.current = true;

        if (containerRef.current) {
            containerRef.current.style.cursor = 'grabbing';
        }

        // Get current position from transform
        if (containerRef.current) {
            const style = containerRef.current.style.transform;
            const match = style.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
            if (match) {
                currentPos.current = { x: parseFloat(match[1]), y: parseFloat(match[2]) };
            }
        }

        if ('touches' in e) {
            dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else {
            dragStart.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleResetPosition = () => {
        if (containerRef.current) {
            containerRef.current.style.transform = 'translate(0px, 0px)';
            currentPos.current = { x: 0, y: 0 };
            localStorage.removeItem(POSITION_KEY);
        }
    };

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

    const floatingClasses = isFloating
        ? 'fixed z-[9996] w-64 shadow-2xl'
        : '';

    return (
        <div
            ref={containerRef}
            className={`bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl shadow-xl overflow-hidden ${floatingClasses}`}
            style={isFloating ? { top: '200px', right: '330px' } : undefined}
        >
            {/* Header */}
            <div className="px-3 py-2 flex items-center justify-between bg-amber-500/30">
                {isFloating && (
                    <div
                        onMouseDown={handleDragStart}
                        onTouchStart={handleDragStart}
                        className="p-1 cursor-grab active:cursor-grabbing hover:bg-amber-600/20 rounded transition-colors mr-2"
                        title="Sürükle"
                    >
                        <GripHorizontal size={14} className="text-amber-900/50" />
                    </div>
                )}
                <div className="flex items-center gap-1.5 flex-1">
                    <StickyNote size={14} className="text-amber-900/70" />
                    <span className="text-xs font-bold text-amber-900/80">Hızlı Not Al</span>
                </div>
                <div className="flex items-center gap-1">
                    {!isSaved && (
                        <span className="text-[10px] text-amber-800/60 italic">kaydediliyor...</span>
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
                    {isFloating && (
                        <>
                            <button
                                onClick={handleResetPosition}
                                className="p-1 text-amber-900/50 hover:text-amber-900 hover:bg-amber-600/20 rounded transition-colors"
                                title="Konumu Sıfırla"
                            >
                                <RotateCcw size={12} />
                            </button>
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="p-1 text-amber-900/50 hover:text-amber-900 hover:bg-amber-600/20 rounded transition-colors"
                                    title="Kapat"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </>
                    )}
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
    );
};

export default StickyNoteWidget;
