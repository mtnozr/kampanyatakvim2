import React from 'react';
import { Play, Pause, RotateCcw, Coffee, Focus, Volume2, VolumeX } from 'lucide-react';
import { usePomodoroContext } from '../contexts/PomodoroContext';

// Circular Progress Component
const CircularProgress: React.FC<{ progress: number; mode: 'work' | 'break' }> = ({ progress, mode }) => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress * circumference);

    const strokeColor = mode === 'work' ? '#ef4444' : '#10b981';

    return (
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-gray-200 dark:text-slate-600"
            />
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
    const {
        state,
        soundEnabled,
        setSoundEnabled,
        handleStart,
        handlePause,
        handleReset,
        handleModeSwitch,
        formatTime,
        progress
    } = usePomodoroContext();

    return (
        <div className={`bg-gradient-to-br ${state.mode === 'work' ? 'from-red-500 to-orange-500' : 'from-green-500 to-teal-500'} rounded-2xl shadow-xl overflow-hidden transition-colors duration-500`}>
            {/* Header */}
            <div className="px-3 py-2 flex items-center justify-between bg-black/10">
                <div className="flex items-center gap-2 text-white">
                    <span className="text-xs font-bold">🍅 Pomodoro</span>
                </div>
                <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                    title={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
                >
                    {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                </button>
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
