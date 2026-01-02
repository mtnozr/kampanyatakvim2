import { useState, useEffect, useCallback, useRef } from 'react';

interface Position {
    x: number;
    y: number;
}

interface UseDraggableOptions {
    storageKey: string;
    defaultPosition?: Position;
    widgetWidth?: number;
    widgetHeight?: number;
}

interface UseDraggableReturn {
    position: Position | null;
    isDragging: boolean;
    handleMouseDown: (e: React.MouseEvent) => void;
    handleTouchStart: (e: React.TouchEvent) => void;
    containerRef: React.RefObject<HTMLDivElement>;
    resetPosition: () => void;
}

export const useDraggable = ({
    storageKey,
    defaultPosition,
    widgetWidth = 288,
    widgetHeight = 100
}: UseDraggableOptions): UseDraggableReturn => {
    const [position, setPosition] = useState<Position | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Load position from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Validate position is within viewport
                const maxX = window.innerWidth - widgetWidth;
                const maxY = window.innerHeight - widgetHeight;
                setPosition({
                    x: Math.max(0, Math.min(parsed.x, maxX)),
                    y: Math.max(0, Math.min(parsed.y, maxY))
                });
            } catch {
                console.error('Failed to parse widget position');
            }
        } else if (defaultPosition) {
            setPosition(defaultPosition);
        }
    }, [storageKey, defaultPosition, widgetWidth, widgetHeight]);

    // Save position to localStorage when changed
    useEffect(() => {
        if (position && !isDragging) {
            localStorage.setItem(storageKey, JSON.stringify(position));
        }
    }, [position, isDragging, storageKey]);

    const handleDragStart = useCallback((clientX: number, clientY: number) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        setDragOffset({
            x: clientX - rect.left,
            y: clientY - rect.top
        });
        setIsDragging(true);
    }, []);

    const handleDragMove = useCallback((clientX: number, clientY: number) => {
        if (!isDragging) return;

        const newX = clientX - dragOffset.x;
        const newY = clientY - dragOffset.y;

        // Keep within viewport bounds
        const maxX = window.innerWidth - widgetWidth;
        const maxY = window.innerHeight - widgetHeight;

        setPosition({
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
        });
    }, [isDragging, dragOffset, widgetWidth, widgetHeight]);

    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Mouse events
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);
    }, [handleDragStart]);

    // Touch events
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        handleDragStart(touch.clientX, touch.clientY);
    }, [handleDragStart]);

    // Global mouse/touch move and end listeners
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
        const handleMouseUp = () => handleDragEnd();
        const handleTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            handleDragMove(touch.clientX, touch.clientY);
        };
        const handleTouchEnd = () => handleDragEnd();

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    // Reset position function
    const resetPosition = useCallback(() => {
        localStorage.removeItem(storageKey);
        setPosition(null);
    }, [storageKey]);

    return {
        position,
        isDragging,
        handleMouseDown,
        handleTouchStart,
        containerRef,
        resetPosition
    };
};

export default useDraggable;
