import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

// Constants
const WORK_DURATION = 25 * 60; // 25 minutes in seconds
const BREAK_DURATION = 5 * 60; // 5 minutes in seconds
const STORAGE_KEY = 'pomodoro_timer_state';

export interface PomodoroState {
    mode: 'work' | 'break';
    remainingSeconds: number;
    isRunning: boolean;
    endTime: number | null;
}

interface PomodoroContextType {
    state: PomodoroState;
    soundEnabled: boolean;
    setSoundEnabled: (enabled: boolean) => void;
    handleStart: () => void;
    handlePause: () => void;
    handleReset: () => void;
    handleModeSwitch: () => void;
    formatTime: (seconds: number) => string;
    progress: number;
    totalDuration: number;
}

const PomodoroContext = createContext<PomodoroContextType | null>(null);

export const usePomodoroContext = () => {
    const context = useContext(PomodoroContext);
    if (!context) {
        throw new Error('usePomodoroContext must be used within PomodoroProvider');
    }
    return context;
};

interface PomodoroProviderProps {
    children: ReactNode;
}

export const PomodoroProvider: React.FC<PomodoroProviderProps> = ({ children }) => {
    const [state, setState] = useState<PomodoroState>({
        mode: 'work',
        remainingSeconds: WORK_DURATION,
        isRunning: false,
        endTime: null
    });
    const [soundEnabled, setSoundEnabled] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load state from localStorage on mount
    useEffect(() => {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
            try {
                const parsed: PomodoroState = JSON.parse(savedState);

                if (parsed.isRunning && parsed.endTime) {
                    const now = Date.now();
                    const remaining = Math.ceil((parsed.endTime - now) / 1000);

                    if (remaining > 0) {
                        setState({
                            ...parsed,
                            remainingSeconds: remaining
                        });
                    } else {
                        handleTimerComplete(parsed.mode);
                    }
                } else {
                    setState(parsed);
                }
            } catch {
                console.error('Failed to parse pomodoro state');
            }
        }

        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

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
        if (soundEnabled) {
            playBeep();
        }

        if ('Notification' in window && Notification.permission === 'granted') {
            const title = completedMode === 'work' ? '🎉 Odaklanma Tamamlandı!' : '☕ Mola Bitti!';
            const body = completedMode === 'work'
                ? 'Harika iş! Şimdi bir mola ver.'
                : 'Molandan döndün, odaklanmaya devam!';

            new Notification(title, { body, icon: '🍅' });
        }

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

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const totalDuration = state.mode === 'work' ? WORK_DURATION : BREAK_DURATION;
    const progress = state.remainingSeconds / totalDuration;

    const value: PomodoroContextType = {
        state,
        soundEnabled,
        setSoundEnabled,
        handleStart,
        handlePause,
        handleReset,
        handleModeSwitch,
        formatTime,
        progress,
        totalDuration
    };

    return (
        <PomodoroContext.Provider value={value}>
            {children}
        </PomodoroContext.Provider>
    );
};

export default PomodoroProvider;
