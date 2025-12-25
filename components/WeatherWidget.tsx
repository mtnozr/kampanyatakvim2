import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Loader2, RefreshCw, MapPin } from 'lucide-react';

interface DayForecast {
    date: Date;
    tempMax: number;
    tempMin: number;
    weatherCode: number;
}

// Weather code to icon mapping (WMO Weather interpretation codes)
const getWeatherIcon = (code: number, size: number = 20) => {
    const className = "shrink-0";

    // Clear sky
    if (code === 0) return <Sun size={size} className={`${className} text-yellow-500`} />;
    // Mainly clear, partly cloudy
    if (code <= 3) return <Sun size={size} className={`${className} text-yellow-400`} />;
    // Fog
    if (code >= 45 && code <= 48) return <Cloud size={size} className={`${className} text-gray-400`} />;
    // Drizzle
    if (code >= 51 && code <= 57) return <CloudRain size={size} className={`${className} text-blue-400`} />;
    // Rain
    if (code >= 61 && code <= 67) return <CloudRain size={size} className={`${className} text-blue-500`} />;
    // Snow
    if (code >= 71 && code <= 77) return <CloudSnow size={size} className={`${className} text-blue-200`} />;
    // Rain showers
    if (code >= 80 && code <= 82) return <CloudRain size={size} className={`${className} text-blue-600`} />;
    // Snow showers
    if (code >= 85 && code <= 86) return <CloudSnow size={size} className={`${className} text-blue-300`} />;
    // Thunderstorm
    if (code >= 95) return <CloudLightning size={size} className={`${className} text-purple-500`} />;
    // Default
    return <Cloud size={size} className={`${className} text-gray-500`} />;
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

    return (
        <div className="bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl shadow-xl overflow-hidden mb-3">
            {/* Header */}
            <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-white">
                    <MapPin size={14} className="opacity-80" />
                    <span className="text-xs font-medium">İstanbul</span>
                </div>
                <button
                    onClick={fetchWeather}
                    disabled={loading}
                    className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Yenile"
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </button>
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
