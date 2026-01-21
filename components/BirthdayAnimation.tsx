import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface BirthdayAnimationProps {
  userName: string;
  onClose: () => void;
}

export const BirthdayAnimation: React.FC<BirthdayAnimationProps> = ({ userName, onClose }) => {
  const [confetti, setConfetti] = useState<Array<{ id: number; left: number; delay: number; color: string; size: number }>>([]);
  const [balloons, setBalloons] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

  useEffect(() => {
    // Generate confetti
    const confettiPieces = Array.from({ length: 150 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#FF85A2', '#7B68EE'][Math.floor(Math.random() * 10)],
      size: Math.random() * 12 + 6
    }));
    setConfetti(confettiPieces);

    // Generate balloons
    const balloonPieces = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 90 + 5,
      delay: Math.random() * 3,
      color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFD93D', '#6BCB77', '#9B59B6', '#E74C3C', '#3498DB', '#FF85A2', '#F39C12'][Math.floor(Math.random() * 10)]
    }));
    setBalloons(balloonPieces);

    // Regenerate confetti periodically for continuous effect
    const interval = setInterval(() => {
      const newConfetti = Array.from({ length: 50 }, (_, i) => ({
        id: Date.now() + i,
        left: Math.random() * 100,
        delay: 0,
        color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'][Math.floor(Math.random() * 8)],
        size: Math.random() * 12 + 6
      }));
      setConfetti(prev => [...prev.slice(-100), ...newConfetti]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-500" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-20 p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
        title="Kapat"
      >
        <X size={28} />
      </button>

      {/* Confetti */}
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="absolute top-0 animate-confetti-fall pointer-events-none"
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '0%',
            transform: `rotate(${Math.random() * 360}deg)`
          }}
        />
      ))}

      {/* Balloons */}
      {balloons.map((balloon) => (
        <div
          key={balloon.id}
          className="absolute bottom-0 animate-balloon-rise pointer-events-none"
          style={{
            left: `${balloon.left}%`,
            animationDelay: `${balloon.delay}s`
          }}
        >
          <div
            className="w-14 h-16 rounded-full relative"
            style={{ backgroundColor: balloon.color }}
          >
            <div
              className="absolute bottom-0 left-1/2 w-0.5 h-20 bg-gray-400"
              style={{ transform: 'translateX(-50%) translateY(100%)' }}
            />
            <div
              className="absolute bottom-0 left-1/2 w-2 h-2 rounded-full"
              style={{ backgroundColor: balloon.color, transform: 'translateX(-50%) translateY(50%)', filter: 'brightness(0.8)' }}
            />
            {/* Balloon shine */}
            <div
              className="absolute top-2 left-2 w-3 h-3 rounded-full bg-white/40"
            />
          </div>
        </div>
      ))}

      {/* Birthday Message */}
      <div className="relative z-10 text-center animate-in zoom-in duration-700 px-4">
        <div className="text-8xl md:text-9xl mb-6 animate-bounce">🎂</div>
        <h1 className="text-5xl md:text-7xl font-black text-white mb-4 drop-shadow-2xl">
          <span className="animate-pulse">Mutlu Yıllar!</span>
        </h1>
        <p className="text-2xl md:text-4xl text-white/90 font-medium mb-8">
          {userName}
        </p>
        <div className="flex justify-center gap-4 text-5xl md:text-6xl">
          <span className="animate-bounce" style={{ animationDelay: '0s' }}>🎈</span>
          <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🎁</span>
          <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🎉</span>
          <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>🎊</span>
          <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>🎈</span>
        </div>
        <p className="mt-10 text-white/50 text-sm flex items-center justify-center gap-2">
          <X size={14} /> Kapatmak için sağ üstteki butona tıklayın
        </p>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes balloon-rise {
          0% {
            transform: translateY(100vh) rotate(-5deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(-150vh) rotate(5deg);
            opacity: 0.8;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall 5s ease-in-out forwards;
        }
        .animate-balloon-rise {
          animation: balloon-rise 8s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
