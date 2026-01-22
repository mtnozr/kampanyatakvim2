import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Coffee, Focus, Volume2, VolumeX, GripHorizontal, RotateCw } from 'lucide-react';

// Constants
const WORK_DURATION = 25 * 60; // 25 minutes in seconds
const BREAK_DURATION = 5 * 60; // 5 minutes in seconds
const STORAGE_KEY = 'pomodoro_timer_state';
const POSITION_STORAGE_KEY = 'pomodoro_position';

interface PomodoroState {
    mode: 'work' | 'break';
    remainingSeconds: number;
    isRunning: boolean;
    endTime: number | null;
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

interface Position {
    x: number;
    y: number;
    isFloating: boolean;
}

export const PomodoroWidget: React.FC = () => {
    const [state, setState] = useState<PomodoroState>({
        mode: 'work',
        remainingSeconds: WORK_DURATION,
        isRunning: false,
        endTime: null
    });
    const [soundEnabled, setSoundEnabled] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Drag state
    const [position, setPosition] = useState<Position>({ x: 0, y: 0, isFloating: false });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
    const widgetRef = useRef<HTMLDivElement>(null);

    // Load state from localStorage on mount
    useEffect(() => {
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

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Load position from localStorage
        const savedPosition = localStorage.getItem(POSITION_STORAGE_KEY);
        if (savedPosition) {
            try {
                const parsed = JSON.parse(savedPosition);
                setPosition(parsed);
            } catch {
                console.error('Failed to parse pomodoro position');
            }
        }
    }, []);

    // Drag handlers
    const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        // If not floating yet, calculate initial position based on current element position
        if (!position.isFloating && widgetRef.current) {
            const rect = widgetRef.current.getBoundingClientRect();
            setPosition({
                x: rect.left,
                y: rect.top,
                isFloating: true
            });
            dragRef.current = {
                startX: clientX,
                startY: clientY,
                initialX: rect.left,
                initialY: rect.top
            };
        } else {
            dragRef.current = {
                startX: clientX,
                startY: clientY,
                initialX: position.x,
                initialY: position.y
            };
        }
        setIsDragging(true);
    }, [position]);

    const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDragging || !dragRef.current) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - dragRef.current.startX;
        const deltaY = clientY - dragRef.current.startY;

        const newX = Math.max(0, Math.min(window.innerWidth - 200, dragRef.current.initialX + deltaX));
        const newY = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.initialY + deltaY));

        setPosition({
            x: newX,
            y: newY,
            isFloating: true
        });
    }, [isDragging]);

    const handleDragEnd = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            dragRef.current = null;
            // Save position to localStorage
            localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
        }
    }, [isDragging, position]);

    const handleResetPosition = () => {
        setPosition({ x: 0, y: 0, isFloating: false });
        localStorage.removeItem(POSITION_STORAGE_KEY);
    };

    // Add/remove event listeners for drag
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleDragMove);
            window.addEventListener('touchend', handleDragEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [state]);

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

    const widgetStyle = position.isFloating ? {
        position: 'fixed' as const,
        left: position.x,
        top: position.y,
        zIndex: 9999,
        width: '200px'
    } : {};

    return (
        <div
            ref={widgetRef}
            style={widgetStyle}
            className={`bg-gradient-to-br ${state.mode === 'work' ? 'from-red-500 to-orange-500' : 'from-green-500 to-teal-500'} rounded-2xl shadow-xl overflow-hidden transition-colors duration-500 ${isDragging ? 'cursor-grabbing' : ''}`}
        >
            {/* Header with drag handle */}
            <div
                className="px-3 py-2 flex items-center justify-between bg-black/10 cursor-grab select-none"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
            >
                <div className="flex items-center gap-2 text-white">
                    <GripHorizontal size={14} className="text-white/50" />
                    <span className="text-xs font-bold">🍅 Pomodoro</span>
                </div>
                <div className="flex items-center gap-1">
                    {position.isFloating && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleResetPosition(); }}
                            className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title="Konumu Sıfırla"
                        >
                            <RotateCw size={12} />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }}
                        className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
                    >
                        {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                    </button>
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
    );
};

export default PomodoroWidget;
