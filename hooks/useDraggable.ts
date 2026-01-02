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

export const useDraggable = ({
    storageKey,
    defaultPosition,
    widgetWidth = 288,
    widgetHeight = 100
}: UseDraggableOptions) => {
    const [position, setPosition] = useState<Position | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Load from localStorage
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
            } catch (e) {
                console.error('Failed to parse position', e);
            }
        } else if (defaultPosition) {
            setPosition(defaultPosition);
        }
    }, [storageKey, defaultPosition, widgetWidth, widgetHeight]);

    // Save to localStorage
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

        if (!position) {
            setPosition({ x: rect.left, y: rect.top });
        }
    }, [position]);

    const handleDragMove = useCallback((clientX: number, clientY: number) => {
        if (!isDragging) return;

        const newX = clientX - dragOffset.x;
        const newY = clientY - dragOffset.y;

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

    // Mouse Down handler
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);
    }, [handleDragStart]);

    // Touch Start handler
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        handleDragStart(touch.clientX, touch.clientY);
    }, [handleDragStart]);

    // Window event listeners
    useEffect(() => {
        if (!isDragging) return;

        const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
        const onMouseUp = () => handleDragEnd();

        const onTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            handleDragMove(touch.clientX, touch.clientY);
        }
        const onTouchEnd = () => handleDragEnd();

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    const resetPosition = () => {
        setPosition(null);
        localStorage.removeItem(storageKey);
    };

    return {
        position,
        isDragging,
        containerRef,
        handleMouseDown,
        handleTouchStart,
        resetPosition
    };
};
