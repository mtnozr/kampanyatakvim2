import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Coffee, Focus, GripVertical, Volume2, VolumeX } from 'lucide-react';

// Constants
const WORK_DURATION = 25 * 60; // 25 minutes in seconds
const BREAK_DURATION = 5 * 60; // 5 minutes in seconds
const STORAGE_KEY = 'pomodoro_timer_state';
const POSITION_KEY = 'pomodoro_position';

interface PomodoroState {
    mode: 'work' | 'break';
    remainingSeconds: number;
    isRunning: boolean;
    endTime: number | null;
}

interface Position {
    x: number;
    y: number;
}

// Circular Progress Component
const CircularProgress: React.FC<{ progress: number; mode: 'work' | 'break' }> = ({ progress, mode }) => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress * circumference);

    const strokeColor = mode === 'work' ? '#ef4444' : '#10b981'; // red for work, green for break

    return (
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {/* Background circle */}
            <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-gray-200 dark:text-slate-600"
            />
            {/* Progress circle */}
            <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={strokeColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-1000 ease-linear"
            />
        </svg>
    );
};

export const PomodoroWidget: React.FC = () => {
    const [state, setState] = useState<PomodoroState>({
        mode: 'work',
        remainingSeconds: WORK_DURATION,
        isRunning: false,
        endTime: null
    });
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [position, setPosition] = useState<Position | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef<Position>({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load state from localStorage on mount
    useEffect(() => {
        // Load timer state
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
            try {
                const parsed: PomodoroState = JSON.parse(savedState);

                if (parsed.isRunning && parsed.endTime) {
                    // Calculate remaining time based on saved endTime
                    const now = Date.now();
                    const remaining = Math.ceil((parsed.endTime - now) / 1000);

                    if (remaining > 0) {
                        setState({
                            ...parsed,
                            remainingSeconds: remaining
                        });
                    } else {
                        // Timer has expired while page was closed
                        handleTimerComplete(parsed.mode);
                    }
                } else {
                    setState(parsed);
                }
            } catch {
                console.error('Failed to parse pomodoro state');
            }
        }

        // Load position
        const savedPosition = localStorage.getItem(POSITION_KEY);
        if (savedPosition) {
            try {
                const pos = JSON.parse(savedPosition);
                setPosition(pos);
            } catch {
                console.error('Failed to parse pomodoro position');
            }
        }

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [state]);

    // Save position to localStorage
    useEffect(() => {
        if (position) {
            localStorage.setItem(POSITION_KEY, JSON.stringify(position));
        }
    }, [position]);

    // Timer interval
    useEffect(() => {
        if (state.isRunning) {
            intervalRef.current = setInterval(() => {
                setState(prev => {
                    if (!prev.endTime) return prev;

                    const remaining = Math.ceil((prev.endTime - Date.now()) / 1000);

                    if (remaining <= 0) {
                        handleTimerComplete(prev.mode);
                        return {
                            ...prev,
                            remainingSeconds: 0,
                            isRunning: false,
                            endTime: null
                        };
                    }

                    return {
                        ...prev,
                        remainingSeconds: remaining
                    };
                });
            }, 1000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [state.isRunning]);

    const handleTimerComplete = (completedMode: 'work' | 'break') => {
        // Play sound
        if (soundEnabled) {
            playBeep();
        }

        // Send notification
        if ('Notification' in window && Notification.permission === 'granted') {
            const title = completedMode === 'work' ? '🎉 Odaklanma Tamamlandı!' : '☕ Mola Bitti!';
            const body = completedMode === 'work'
                ? 'Harika iş! Şimdi bir mola ver.'
                : 'Molandan döndün, odaklanmaya devam!';

            new Notification(title, { body, icon: '🍅' });
        }

        // Switch mode
        const nextMode = completedMode === 'work' ? 'break' : 'work';
        const nextDuration = nextMode === 'work' ? WORK_DURATION : BREAK_DURATION;

        setState({
            mode: nextMode,
            remainingSeconds: nextDuration,
            isRunning: false,
            endTime: null
        });
    };

    const playBeep = () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 300);
        } catch (e) {
            console.error('Failed to play beep:', e);
        }
    };

    const handleStart = () => {
        const endTime = Date.now() + state.remainingSeconds * 1000;
        setState(prev => ({
            ...prev,
            isRunning: true,
            endTime
        }));
    };

    const handlePause = () => {
        setState(prev => ({
            ...prev,
            isRunning: false,
            endTime: null
        }));
    };

    const handleReset = () => {
        const duration = state.mode === 'work' ? WORK_DURATION : BREAK_DURATION;
        setState(prev => ({
            ...prev,
            remainingSeconds: duration,
            isRunning: false,
            endTime: null
        }));
    };

    const handleModeSwitch = () => {
        const nextMode = state.mode === 'work' ? 'break' : 'work';
        const nextDuration = nextMode === 'work' ? WORK_DURATION : BREAK_DURATION;
        setState({
            mode: nextMode,
            remainingSeconds: nextDuration,
            isRunning: false,
            endTime: null
        });
    };

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate progress (0 to 1)
    const totalDuration = state.mode === 'work' ? WORK_DURATION : BREAK_DURATION;
    const progress = state.remainingSeconds / totalDuration;

    // Drag handlers
    const handleDragStart = useCallback((clientX: number, clientY: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
        setIsDragging(true);
    }, []);

    const handleDragMove = useCallback((clientX: number, clientY: number) => {
        if (!isDragging) return;
        const newX = clientX - dragOffset.current.x;
        const newY = clientY - dragOffset.current.y;
        const maxX = window.innerWidth - 288;
        const maxY = window.innerHeight - 200;
        setPosition({
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
        });
    }, [isDragging]);

    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        handleDragStart(touch.clientX, touch.clientY);
    };

    useEffect(() => {
        if (isDragging) {
            const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
            const handleMouseUp = () => handleDragEnd();
            const handleTouchMove = (e: TouchEvent) => {
                e.preventDefault();
                handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
            };
            const handleTouchEnd = () => handleDragEnd();

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
            document.body.style.userSelect = 'none';

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
                document.body.style.userSelect = '';
            };
        }
    }, [isDragging, handleDragMove, handleDragEnd]);

    const resetPosition = () => {
        localStorage.removeItem(POSITION_KEY);
        setPosition(null);
    };

    const isFloating = position !== null;

    const containerStyle: React.CSSProperties = isFloating
        ? { position: 'fixed', left: position.x, top: position.y, zIndex: 50, width: 288 }
        : { position: 'relative', width: '100%' };

    return (
        <div ref={containerRef} style={containerStyle} className={isDragging ? 'shadow-2xl scale-[1.02]' : ''}>
            <div className={`bg-gradient-to-br ${state.mode === 'work' ? 'from-red-500 to-orange-500' : 'from-green-500 to-teal-500'} rounded-2xl shadow-xl overflow-hidden transition-colors duration-500`}>
                {/* Header with drag handle */}
                <div
                    className={`px-3 py-2 flex items-center justify-between bg-black/10 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                >
                    <div className="flex items-center gap-2 text-white">
                        <GripVertical size={14} className="opacity-70" />
                        <span className="text-xs font-bold">🍅 Pomodoro</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }}
                            className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
                        >
                            {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                        </button>
                        {isFloating && (
                            <button
                                onClick={(e) => { e.stopPropagation(); resetPosition(); }}
                                className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                                title="Varsayılan konuma döndür"
                            >
                                <RotateCcw size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Timer Display */}
                <div className="p-4">
                    {/* Mode indicator */}
                    <div className="flex justify-center mb-3">
                        <button
                            onClick={handleModeSwitch}
                            className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-white text-xs font-medium transition-colors"
                        >
                            {state.mode === 'work' ? (
                                <>
                                    <Focus size={12} />
                                    <span>Odaklanma</span>
                                </>
                            ) : (
                                <>
                                    <Coffee size={12} />
                                    <span>Mola</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Circular timer */}
                    <div className="relative w-32 h-32 mx-auto mb-4">
                        <CircularProgress progress={progress} mode={state.mode} />
                        <div className="absolute inset-0 flex items-center justify-center rotate-0">
                            <span className="text-3xl font-bold text-white font-mono tracking-wider">
                                {formatTime(state.remainingSeconds)}
                            </span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex justify-center gap-2">
                        {!state.isRunning ? (
                            <button
                                onClick={handleStart}
                                className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-800 rounded-xl font-medium text-sm hover:bg-gray-100 active:scale-95 transition-all shadow-lg"
                            >
                                <Play size={16} fill="currentColor" />
                                <span>Başlat</span>
                            </button>
                        ) : (
                            <button
                                onClick={handlePause}
                                className="flex items-center gap-1.5 px-4 py-2 bg-white/90 text-gray-800 rounded-xl font-medium text-sm hover:bg-white active:scale-95 transition-all shadow-lg"
                            >
                                <Pause size={16} fill="currentColor" />
                                <span>Duraklat</span>
                            </button>
                        )}
                        <button
                            onClick={handleReset}
                            className="p-2 bg-white/20 text-white rounded-xl hover:bg-white/30 active:scale-95 transition-all"
                            title="Sıfırla"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PomodoroWidget;
