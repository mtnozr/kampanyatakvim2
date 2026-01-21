import React, { useEffect, useState } from 'react';

interface BirthdayAnimationProps {
  userName: string;
  onClose: () => void;
}

export const BirthdayAnimation: React.FC<BirthdayAnimationProps> = ({ userName, onClose }) => {
  const [confetti, setConfetti] = useState<Array<{ id: number; left: number; delay: number; color: string; size: number }>>([]);
  const [balloons, setBalloons] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

  useEffect(() => {
    // Generate confetti
    const confettiPieces = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'][Math.floor(Math.random() * 8)],
      size: Math.random() * 10 + 5
    }));
    setConfetti(confettiPieces);

    // Generate balloons
    const balloonPieces = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: Math.random() * 90 + 5,
      delay: Math.random() * 2,
      color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFD93D', '#6BCB77', '#9B59B6', '#E74C3C', '#3498DB'][Math.floor(Math.random() * 8)]
    }));
    setBalloons(balloonPieces);

    // Auto close after 8 seconds
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      onClick={onClose}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500" />

      {/* Confetti */}
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="absolute top-0 animate-confetti-fall"
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
          className="absolute bottom-0 animate-balloon-rise"
          style={{
            left: `${balloon.left}%`,
            animationDelay: `${balloon.delay}s`
          }}
        >
          <div
            className="w-12 h-14 rounded-full relative"
            style={{ backgroundColor: balloon.color }}
          >
            <div
              className="absolute bottom-0 left-1/2 w-0.5 h-16 bg-gray-400"
              style={{ transform: 'translateX(-50%) translateY(100%)' }}
            />
            <div
              className="absolute bottom-0 left-1/2 w-2 h-2 rounded-full"
              style={{ backgroundColor: balloon.color, transform: 'translateX(-50%) translateY(50%)', filter: 'brightness(0.8)' }}
            />
          </div>
        </div>
      ))}

      {/* Birthday Message */}
      <div className="relative z-10 text-center animate-in zoom-in duration-700">
        <div className="text-8xl mb-6 animate-bounce">🎂</div>
        <h1 className="text-5xl md:text-7xl font-black text-white mb-4 drop-shadow-2xl animate-pulse">
          Mutlu Yillar!
        </h1>
        <p className="text-2xl md:text-3xl text-white/90 font-medium mb-8">
          {userName}
        </p>
        <div className="flex justify-center gap-4 text-5xl">
          <span className="animate-bounce" style={{ animationDelay: '0s' }}>🎈</span>
          <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🎁</span>
          <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🎉</span>
          <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>🎊</span>
          <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>🎈</span>
        </div>
        <p className="mt-8 text-white/60 text-sm">Kapatmak icin tiklayin</p>
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
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-120vh) rotate(5deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall 4s ease-in-out forwards;
        }
        .animate-balloon-rise {
          animation: balloon-rise 6s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
