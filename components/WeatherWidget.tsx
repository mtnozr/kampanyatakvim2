import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Loader2, RefreshCw, MapPin, GripVertical, RotateCcw } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

interface DayForecast {
    date: Date;
    tempMax: number;
    tempMin: number;
    weatherCode: number;
}

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

export const WeatherWidget: React.FC = () => {
    const [forecast, setForecast] = useState<DayForecast[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const {
        position,
        isDragging,
        handleMouseDown,
        handleTouchStart,
        containerRef,
        resetPosition
    } = useDraggable({
        storageKey: 'kampanya_takvim_weather_position',
        widgetWidth: 288,
        widgetHeight: 180
    });

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
            <div className={`bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl shadow-xl overflow-hidden ${isDragging ? 'shadow-2xl scale-[1.02]' : ''} transition-shadow`}>
                {/* Header with drag handle */}
                <div className="flex items-stretch">
                    {/* Drag Handle */}
                    <div
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        className="px-2 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors border-r border-white/20 touch-none"
                        title="Sürükle"
                    >
                        <GripVertical size={16} className="text-white/70" />
                    </div>

                    {/* Header Content */}
                    <div className="flex-1 px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-white">
                            <MapPin size={14} className="opacity-80" />
                            <span className="text-xs font-medium">İstanbul</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {position && (
                                <button
                                    onClick={resetPosition}
                                    className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    title="Konumu Sıfırla"
                                >
                                    <RotateCcw size={12} />
                                </button>
                            )}
                            <button
                                onClick={() => window.location.reload()}
                                className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                title="Sayfayı Yenile"
                            >
                                <RefreshCw size={12} />
                            </button>
                            <button
                                onClick={fetchWeather}
                                disabled={loading}
                                className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                                title="Hava Durumunu Yenile"
                            >
                                <Cloud size={12} className={loading ? 'animate-pulse' : ''} />
                            </button>
                        </div>
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
        </div>
    );
};

export default WeatherWidget;

