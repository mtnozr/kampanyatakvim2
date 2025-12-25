import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Save, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'kampanya_takvim_sticky_note';

export const StickyNoteWidget: React.FC = () => {
    const [note, setNote] = useState('');
    const [isSaved, setIsSaved] = useState(true);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    return (
        <div className="bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 flex items-center justify-between bg-amber-500/30">
                <div className="flex items-center gap-1.5">
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
                <div className="px-3 pb-2">
                    <p className="text-[9px] text-amber-900/40 text-center flex items-center justify-center gap-1">
                        <Save size={8} />
                        Son kayıt: {lastSaved.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            )}
        </div>
    );
};

export default StickyNoteWidget;
