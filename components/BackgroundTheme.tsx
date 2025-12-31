import React, { useEffect, useState } from 'react';

export type ThemeType = 'none' | 'newyear' | 'ramazan' | 'kurban' | 'april23';

interface BackgroundThemeProps {
    activeTheme: ThemeType;
    customImage?: string;
}

// Theme configurations
const THEME_CONFIGS: Record<ThemeType, {
    name: string;
    emoji: string;
    particles: string[];
    colors: string[];
    animation: 'snow' | 'float' | 'confetti' | 'none';
    backgroundImage?: string;
}> = {
    none: {
        name: 'Kapalı',
        emoji: '⚪',
        particles: [],
        colors: [],
        animation: 'none'
    },
    newyear: {
        name: 'Yılbaşı',
        emoji: '🎄',
        particles: ['❄️', '✨', '🎄', '⭐', '🎅'],
        colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'],
        animation: 'snow',
        backgroundImage: 'https://images.unsplash.com/photo-1482517967863-00e015c9e8af?w=1920&q=80'
    },
    ramazan: {
        name: 'Ramazan Bayramı',
        emoji: '🌙',
        particles: ['🌙', '⭐', '✨', '🕌', '🏮'],
        colors: ['#f1c40f', '#9b59b6', '#1abc9c', '#3498db'],
        animation: 'float',
        backgroundImage: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=1920&q=80'
    },
    kurban: {
        name: 'Kurban Bayramı',
        emoji: '🐏',
        particles: ['🐏', '🌙', '⭐', '✨', '🕌'],
        colors: ['#27ae60', '#f39c12', '#8e44ad', '#2980b9'],
        animation: 'float',
        backgroundImage: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?w=1920&q=80'
    },
    april23: {
        name: '23 Nisan',
        emoji: '🎈',
        particles: ['🎈', '🎉', '🎊', '🇹🇷', '⭐'],
        colors: ['#e74c3c', '#ffffff', '#e74c3c', '#f39c12'],
        animation: 'confetti',
        backgroundImage: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1920&q=80'
    }
};

// Generate random particles
const generateParticles = (theme: ThemeType, count: number) => {
    const config = THEME_CONFIGS[theme];
    if (!config.particles.length) return [];

    return Array.from({ length: count }, (_, i) => ({
        id: i,
        emoji: config.particles[Math.floor(Math.random() * config.particles.length)],
        left: Math.random() * 100,
        delay: Math.random() * 10,
        duration: 10 + Math.random() * 10,
        size: 0.8 + Math.random() * 0.6
    }));
};

export const BackgroundTheme: React.FC<BackgroundThemeProps> = ({ activeTheme, customImage }) => {
    const [particles, setParticles] = useState<any[]>([]);

    useEffect(() => {
        if (activeTheme !== 'none') {
            setParticles(generateParticles(activeTheme, 30));
        } else {
            setParticles([]);
        }
    }, [activeTheme]);

    if (activeTheme === 'none') return null;

    const config = THEME_CONFIGS[activeTheme];
    // Use custom image if provided, otherwise fall back to default
    const imageToUse = customImage || config.backgroundImage;

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
            {/* Background Image */}
            {imageToUse && (
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.08]"
                    style={{
                        backgroundImage: `url(${imageToUse})`
                    }}
                />
            )}

            {/* Particles */}
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className={`absolute select-none opacity-30 ${config.animation === 'snow' ? 'animate-snow' :
                        config.animation === 'float' ? 'animate-float' :
                            config.animation === 'confetti' ? 'animate-confetti' : ''
                        }`}
                    style={{
                        left: `${particle.left}%`,
                        animationDelay: `${particle.delay}s`,
                        animationDuration: `${particle.duration}s`,
                        fontSize: `${particle.size}rem`,
                        top: '-5%'
                    }}
                >
                    {particle.emoji}
                </div>
            ))}

            {/* Subtle overlay gradient */}
            <div
                className="absolute inset-0 opacity-5"
                style={{
                    background: config.colors.length > 1
                        ? `linear-gradient(135deg, ${config.colors.join(', ')})`
                        : 'transparent'
                }}
            />
        </div>
    );
};

// Export theme configs for admin panel
export { THEME_CONFIGS };
export default BackgroundTheme;
