import React, { useState } from 'react';
import { X, Cake, PartyPopper } from 'lucide-react';

interface BirthdayReminderProps {
  birthdayPeople: Array<{ name: string; emoji?: string }>;
  onDismiss: () => void;
}

export const BirthdayReminder: React.FC<BirthdayReminderProps> = ({ birthdayPeople, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || birthdayPeople.length === 0) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  const names = birthdayPeople.map(p => p.name).join(', ');
  const isSingle = birthdayPeople.length === 1;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-right duration-500">
      <div className="relative overflow-hidden rounded-2xl shadow-2xl">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 animate-gradient-x" />

        {/* Sparkle effects */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full animate-pulse opacity-60"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.2}s`
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative p-4 text-white">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
              <Cake size={24} />
            </div>

            {/* Text */}
            <div className="flex-1 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🎂</span>
                <h3 className="font-bold text-sm">Dogum Gunu!</h3>
                <PartyPopper size={16} className="animate-pulse" />
              </div>

              <p className="text-sm opacity-90 leading-snug">
                Bugun <span className="font-bold">{names}</span>'{isSingle ? 'in' : 'in'} dogum gunu!
              </p>

              <p className="text-xs mt-2 opacity-75 flex items-center gap-1">
                <span className="animate-pulse">🎉</span>
                Mutlu Yillar demeyi unutma!
              </p>
            </div>
          </div>

          {/* Emojis row */}
          <div className="flex justify-center gap-2 mt-3 text-xl">
            {birthdayPeople.slice(0, 3).map((person, i) => (
              <span key={i} className="animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
                {person.emoji || '🎈'}
              </span>
            ))}
            <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>🎁</span>
            <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>🎊</span>
          </div>
        </div>
      </div>

      {/* CSS for gradient animation */}
      <style>{`
        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
  );
};
