import { useState, useEffect, useCallback, useRef } from 'react';

interface Position {
    x: number;
    y: number;
}

interface UseDraggableOptions {
    storageKey: string;
    defaultPosition?: Position;
    containerWidth?: number;
    containerHeight?: number;
}

interface UseDraggableReturn {
    position: Position | null;
    isDragging: boolean;
    zIndex: number;
    handleMouseDown: (e: React.MouseEvent) => void;
    handleTouchStart: (e: React.TouchEvent) => void;
    bringToFront: () => void;
    resetPosition: () => void;
    containerRef: React.RefObject<HTMLDivElement>;
}

// Global z-index counter for stacking order
let globalZIndexCounter = 100;

function getNextZIndex(): number {
    return ++globalZIndexCounter;
}

export function useDraggable(options: UseDraggableOptions): UseDraggableReturn {
    const { storageKey, defaultPosition, containerWidth = 288, containerHeight = 200 } = options;

    const [position, setPosition] = useState<Position | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [zIndex, setZIndex] = useState(100);
    const dragOffset = useRef<Position>({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Load position from localStorage on mount
    useEffect(() => {
        const savedData = localStorage.getItem(`widget_position_${storageKey}`);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.x !== undefined && parsed.y !== undefined) {
                    // Validate position is within viewport
                    const maxX = window.innerWidth - containerWidth;
                    const maxY = window.innerHeight - containerHeight;
                    setPosition({
                        x: Math.max(0, Math.min(parsed.x, maxX)),
                        y: Math.max(0, Math.min(parsed.y, maxY))
                    });
                }
            } catch {
                console.error(`Failed to parse position for ${storageKey}`);
            }
        } else if (defaultPosition) {
            setPosition(defaultPosition);
        }
    }, [storageKey, defaultPosition, containerWidth, containerHeight]);

    // Save position to localStorage when it changes
    useEffect(() => {
        if (position) {
            localStorage.setItem(`widget_position_${storageKey}`, JSON.stringify({
                x: position.x,
                y: position.y,
                savedAt: new Date().toISOString()
            }));
        }
    }, [position, storageKey]);

    const handleDragStart = useCallback((clientX: number, clientY: number) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        dragOffset.current = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
        setIsDragging(true);
        setZIndex(getNextZIndex());
    }, []);

    const handleDragMove = useCallback((clientX: number, clientY: number) => {
        if (!isDragging) return;

        const newX = clientX - dragOffset.current.x;
        const newY = clientY - dragOffset.current.y;

        // Keep within viewport bounds
        const maxX = window.innerWidth - containerWidth;
        const maxY = window.innerHeight - containerHeight;

        setPosition({
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
        });
    }, [isDragging, containerWidth, containerHeight]);

    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Mouse events
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleDragStart(e.clientX, e.clientY);
    }, [handleDragStart]);

    // Touch events
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        handleDragStart(touch.clientX, touch.clientY);
    }, [handleDragStart]);

    // Global mouse move and up listeners
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
        const handleMouseUp = () => handleDragEnd();

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    // Global touch move and end listeners
    useEffect(() => {
        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging) return;
            e.preventDefault(); // Prevent scrolling while dragging
            const touch = e.touches[0];
            handleDragMove(touch.clientX, touch.clientY);
        };
        const handleTouchEnd = () => handleDragEnd();

        if (isDragging) {
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    const bringToFront = useCallback(() => {
        setZIndex(getNextZIndex());
    }, []);

    const resetPosition = useCallback(() => {
        localStorage.removeItem(`widget_position_${storageKey}`);
        setPosition(null);
    }, [storageKey]);

    return {
        position,
        isDragging,
        zIndex,
        handleMouseDown,
        handleTouchStart,
        bringToFront,
        resetPosition,
        containerRef: containerRef as React.RefObject<HTMLDivElement>
    };
}

export default useDraggable;
