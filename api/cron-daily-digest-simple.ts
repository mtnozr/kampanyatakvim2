import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// Initialize Firebase Admin inline
function initFirebaseAdmin() {
    if (!admin.apps.length) {
        try {
            const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;

            if (!serviceAccountStr) {
                throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
            }

            let serviceAccount;
            try {
                serviceAccount = JSON.parse(serviceAccountStr);
            } catch (e) {
                throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
            }

            // Fix private_key newlines if they are escaped literal "\n"
            if (serviceAccount.private_key) {
                const rawKey = serviceAccount.private_key;
                let key = rawKey.replace(/\\n/g, '\n');

                const match = key.match(/-----BEGIN PRIVATE KEY-----([\s\S]*)-----END PRIVATE KEY-----/);
                if (match && match[1]) {
                    const body = match[1].replace(/\s/g, '');
                    key = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
                }

                serviceAccount.private_key = key;
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } catch (error: any) {
            console.error('Firebase Admin Initialization Error:', error);
            throw error;
        }
    }

    return admin;
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // 1. Verify Authorization
    const authHeader = req.headers.authorization;
    const queryKey = Array.isArray(req.query.key) ? req.query.key[0] : req.query.key;
    const expectedKey = process.env.CRON_SECRET_KEY;

    console.log('Auth check:', {
        queryKey,
        queryKeyLength: queryKey?.length,
        expectedKey: expectedKey?.substring(0, 5) + '...',
        expectedKeyLength: expectedKey?.length,
        match: queryKey === expectedKey
    });

    if (queryKey !== expectedKey && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn('Cron request received without valid secret key.');
        return res.status(401).json({
            error: 'Unauthorized',
            debug: {
                hasKey: !!queryKey,
                hasExpectedKey: !!expectedKey,
                keyLength: queryKey?.length,
                expectedLength: expectedKey?.length,
                keyPreview: queryKey?.substring(0, 5),
                expectedPreview: expectedKey?.substring(0, 5)
            }
        });
    }

    try {
        console.log('Starting Daily Digest Cron Job...');

        // Initialize Admin SDK
        const adminSDK = initFirebaseAdmin();
        const db = adminSDK.firestore();

        // 2. Load Settings
        const settingsDoc = await db.collection('reminderSettings').doc('default').get();

        if (!settingsDoc.exists) {
            console.error('No settings found');
            return res.status(500).json({ error: 'Settings not configured' });
        }

        const settings = settingsDoc.data();

        if (!settings?.dailyDigestEnabled) {
            console.log('Daily digest is disabled in settings.');
            return res.status(200).json({ status: 'skipped', reason: 'disabled' });
        }

        // Success - return basic info
        return res.status(200).json({
            success: true,
            message: 'Cron job test successful',
            settings: {
                enabled: settings.dailyDigestEnabled,
                time: settings.dailyDigestTime
            }
        });

    } catch (error) {
        console.error('Cron job error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
    }
}
