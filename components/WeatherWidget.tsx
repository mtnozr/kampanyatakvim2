import React, { useState, useEffect, useRef } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Loader2, RefreshCw, MapPin, GripHorizontal, RotateCcw, X } from 'lucide-react';

interface DayForecast {
    date: Date;
    tempMax: number;
    tempMin: number;
    weatherCode: number;
}

interface WeatherWidgetProps {
    isFloating?: boolean;
    onClose?: () => void;
}

const POSITION_KEY = 'weather_widget_position';

// Weather code to icon mapping (WMO Weather interpretation codes)
// Using bright colors for visibility on gradient background
const getWeatherIcon = (code: number, size: number = 20) => {
    const baseClass = "shrink-0 drop-shadow-sm";

    // Clear sky
    if (code === 0) return <Sun size={size} className={`${baseClass} text-yellow-300`} />;
    // Mainly clear, partly cloudy
    if (code <= 3) return <Sun size={size} className={`${baseClass} text-amber-300`} />;
    // Fog
    if (code >= 45 && code <= 48) return <Cloud size={size} className={`${baseClass} text-white/80`} />;
    // Drizzle
    if (code >= 51 && code <= 57) return <CloudRain size={size} className={`${baseClass} text-cyan-200`} />;
    // Rain
    if (code >= 61 && code <= 67) return <CloudRain size={size} className={`${baseClass} text-white`} />;
    // Snow
    if (code >= 71 && code <= 77) return <CloudSnow size={size} className={`${baseClass} text-white`} />;
    // Rain showers
    if (code >= 80 && code <= 82) return <CloudRain size={size} className={`${baseClass} text-cyan-100`} />;
    // Snow showers
    if (code >= 85 && code <= 86) return <CloudSnow size={size} className={`${baseClass} text-white`} />;
    // Thunderstorm
    if (code >= 95) return <CloudLightning size={size} className={`${baseClass} text-yellow-200`} />;
    // Default
    return <Cloud size={size} className={`${baseClass} text-white/70`} />;
};

// Get Turkish day names
const getDayName = (date: Date, index: number): string => {
    if (index === 0) return 'Bugün';
    if (index === 1) return 'Yarın';
    return date.toLocaleDateString('tr-TR', { weekday: 'short' });
};

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ isFloating = false, onClose }) => {
    const [forecast, setForecast] = useState<DayForecast[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

    const fetchWeather = async () => {
        setLoading(true);
        setError(null);

        try {
            // Istanbul coordinates
            const lat = 41.0082;
            const lon = 28.9784;

            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Europe/Istanbul&forecast_days=5`
            );

            if (!response.ok) throw new Error('Hava durumu alınamadı');

            const data = await response.json();

            const forecastData: DayForecast[] = data.daily.time.map((time: string, i: number) => ({
                date: new Date(time),
                tempMax: Math.round(data.daily.temperature_2m_max[i]),
                tempMin: Math.round(data.daily.temperature_2m_min[i]),
                weatherCode: data.daily.weather_code[i]
            }));

            setForecast(forecastData);
            setLastUpdated(new Date());
        } catch (err) {
            setError('Veri alınamadı');
            console.error('Weather fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWeather();
        // Refresh every 30 minutes
        const interval = setInterval(fetchWeather, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const floatingClasses = isFloating
        ? 'fixed z-[9997] w-72 shadow-2xl'
        : '';

    return (
        <div
            ref={containerRef}
            className={`bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl shadow-xl overflow-hidden ${floatingClasses}`}
            style={isFloating ? { top: '100px', right: '330px' } : undefined}
        >
            {/* Header */}
            <div className="px-3 py-2 flex items-center justify-between">
                {isFloating && (
                    <div
                        onMouseDown={handleDragStart}
                        onTouchStart={handleDragStart}
                        className="p-1 cursor-grab active:cursor-grabbing hover:bg-white/10 rounded transition-colors mr-2"
                        title="Sürükle"
                    >
                        <GripHorizontal size={14} className="text-white/60" />
                    </div>
                )}
                <div className="flex items-center gap-1.5 text-white flex-1">
                    <MapPin size={14} className="opacity-80" />
                    <span className="text-xs font-medium">İstanbul</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={fetchWeather}
                        disabled={loading}
                        className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Hava Durumunu Yenile"
                    >
                        <Cloud size={12} className={loading ? 'animate-pulse' : ''} />
                    </button>
                    {isFloating && (
                        <>
                            <button
                                onClick={handleResetPosition}
                                className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                title="Konumu Sıfırla"
                            >
                                <RotateCcw size={12} />
                            </button>
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
            <div className="px-3 pb-3">
                {loading && forecast.length === 0 ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 size={20} className="text-white animate-spin" />
                    </div>
                ) : error ? (
                    <div className="text-center py-3 text-white/80 text-xs">
                        {error}
                    </div>
                ) : (
                    <div className="grid grid-cols-5 gap-1">
                        {forecast.map((day, index) => (
                            <div
                                key={day.date.toISOString()}
                                className={`flex flex-col items-center p-1.5 rounded-xl transition-colors ${index === 0
                                    ? 'bg-white/20'
                                    : 'hover:bg-white/10'
                                    }`}
                            >
                                <span className="text-[10px] text-white/90 font-medium mb-1">
                                    {getDayName(day.date, index)}
                                </span>
                                <div className="my-1">
                                    {getWeatherIcon(day.weatherCode, 18)}
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-xs font-bold text-white">
                                        {day.tempMax}°
                                    </span>
                                    <span className="text-[10px] text-white/60">
                                        {day.tempMin}°
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Last updated */}
            {lastUpdated && (
                <div className="px-3 pb-2">
                    <p className="text-[9px] text-white/40 text-center">
                        Son güncelleme: {lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            )}
        </div>
    );
};

export default WeatherWidget;
