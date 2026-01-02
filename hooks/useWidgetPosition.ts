import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface Position {
    x: number;
    y: number;
}

interface WidgetPositions {
    [widgetId: string]: Position;
}

const STORAGE_KEY = 'widget_positions';
const FIREBASE_COLLECTION = 'widget_settings';

// Generate a unique device ID for Firebase
const getDeviceId = (): string => {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
};

export const useWidgetPosition = (widgetId: string) => {
    const [position, setPosition] = useState<Position | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load position from localStorage first, then sync with Firebase
    useEffect(() => {
        const loadPosition = async () => {
            // First, load from localStorage (fast)
            const savedPositions = localStorage.getItem(STORAGE_KEY);
            if (savedPositions) {
                try {
                    const positions: WidgetPositions = JSON.parse(savedPositions);
                    if (positions[widgetId]) {
                        setPosition(positions[widgetId]);
                    }
                } catch {
                    console.error('Failed to parse widget positions from localStorage');
                }
            }

            // Then, sync with Firebase
            try {
                const deviceId = getDeviceId();
                const docRef = doc(db, FIREBASE_COLLECTION, deviceId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as WidgetPositions;
                    if (data[widgetId]) {
                        setPosition(data[widgetId]);
                        // Update localStorage with Firebase data
                        const updatedPositions = savedPositions ? JSON.parse(savedPositions) : {};
                        updatedPositions[widgetId] = data[widgetId];
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPositions));
                    }
                }
            } catch (error) {
                console.error('Failed to load position from Firebase:', error);
            }

            setIsLoading(false);
        };

        loadPosition();
    }, [widgetId]);

    // Save position to localStorage and Firebase
    const savePosition = useCallback(async (newPosition: Position) => {
        setPosition(newPosition);

        // Save to localStorage immediately
        const savedPositions = localStorage.getItem(STORAGE_KEY);
        const positions: WidgetPositions = savedPositions ? JSON.parse(savedPositions) : {};
        positions[widgetId] = newPosition;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));

        // Save to Firebase asynchronously
        try {
            const deviceId = getDeviceId();
            const docRef = doc(db, FIREBASE_COLLECTION, deviceId);

            // Get existing positions and merge
            const docSnap = await getDoc(docRef);
            const existingData = docSnap.exists() ? docSnap.data() : {};

            await setDoc(docRef, {
                ...existingData,
                [widgetId]: newPosition,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to save position to Firebase:', error);
        }
    }, [widgetId]);

    // Reset position
    const resetPosition = useCallback(async () => {
        setPosition(null);

        // Remove from localStorage
        const savedPositions = localStorage.getItem(STORAGE_KEY);
        if (savedPositions) {
            const positions: WidgetPositions = JSON.parse(savedPositions);
            delete positions[widgetId];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
        }

        // Remove from Firebase
        try {
            const deviceId = getDeviceId();
            const docRef = doc(db, FIREBASE_COLLECTION, deviceId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = { ...docSnap.data() };
                delete data[widgetId];
                await setDoc(docRef, data);
            }
        } catch (error) {
            console.error('Failed to reset position in Firebase:', error);
        }
    }, [widgetId]);

    return {
        position,
        savePosition,
        resetPosition,
        isLoading
    };
};

export default useWidgetPosition;
