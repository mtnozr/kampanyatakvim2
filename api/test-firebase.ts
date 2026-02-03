import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initFirebaseAdmin } from './lib/firebaseAdmin';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    try {
        console.log('Testing Firebase Admin initialization...');

        // Test 1: Check environment variable
        const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;
        console.log('Has FIREBASE_SERVICE_ACCOUNT:', hasServiceAccount);

        if (!hasServiceAccount) {
            return res.status(500).json({
                error: 'FIREBASE_SERVICE_ACCOUNT not found',
                envKeys: Object.keys(process.env).filter(k => k.includes('FIREBASE') || k.includes('CRON'))
            });
        }

        // Test 2: Initialize admin
        console.log('Initializing Firebase Admin...');
        const admin = initFirebaseAdmin();
        console.log('Firebase Admin initialized successfully');

        // Test 3: Get Firestore instance
        const db = admin.firestore();
        console.log('Firestore instance obtained');

        // Test 4: Try to read a collection
        console.log('Attempting to read reminderSettings...');
        const settingsDoc = await db.collection('reminderSettings').doc('default').get();
        console.log('Settings doc exists:', settingsDoc.exists);

        return res.status(200).json({
            success: true,
            hasServiceAccount,
            settingsExists: settingsDoc.exists,
            message: 'Firebase Admin working correctly'
        });

    } catch (error: any) {
        console.error('Test error:', error);
        return res.status(500).json({
            error: error.message,
            stack: error.stack,
            name: error.name
        });
    }
}
