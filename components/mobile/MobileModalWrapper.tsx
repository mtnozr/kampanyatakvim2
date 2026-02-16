import React, { useEffect, useState, useRef, useCallback } from 'react';

interface MobileModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const MobileModalWrapper: React.FC<MobileModalWrapperProps> = ({
  isOpen,
  onClose,
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const currentTranslateY = useRef(0);

  // Mount/unmount with animation
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (visible) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [visible]);

  // Drag to dismiss handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    // Only start drag from the handle area (top 40px)
    const rect = sheet.getBoundingClientRect();
    const touchY = e.touches[0].clientY;
    if (touchY - rect.top > 40) return;

    dragStartY.current = e.touches[0].clientY;
    currentTranslateY.current = 0;
    sheet.style.transition = 'none';
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    const deltaY = e.touches[0].clientY - dragStartY.current;
    // Only allow dragging downward
    if (deltaY > 0) {
      currentTranslateY.current = deltaY;
      sheet.style.transform = `translateY(${deltaY}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragStartY.current === null) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    sheet.style.transition = '';
    dragStartY.current = null;

    // If dragged more than 100px down, close
    if (currentTranslateY.current > 100) {
      onClose();
    } else {
      sheet.style.transform = '';
    }
    currentTranslateY.current = 0;
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          animateIn ? 'opacity-50' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-out ${
          animateIn ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          height: '95vh',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3 shrink-0 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MobileModalWrapper;
