/**
 * Vercel Cron Job for Daily Digest
 * Runs periodically to check and send daily digest emails
 * Server-Side Implementation using Admin SDK
 * Triggering Vercel Deploy
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initFirebaseAdmin } from './lib/firebaseAdmin';
import { processDailyDigest } from '../utils/dailyDigestProcessor';
import { ReminderSettings, CalendarEvent, User, DepartmentUser } from '../types';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // 1. Verify Authorization (Vercel Cron Secret)
    const authHeader = req.headers.authorization;
    if (req.query.key !== process.env.CRON_SECRET_KEY && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Log unauthorized attempt but return 401 if strict security is desired
        console.warn('Cron request received without valid secret key.');
        // For debugging/testing without secret, you might comment this out, 
        // but for production it's safer to return 401.
        // return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('Starting Daily Digest Cron Job...');

        // Initialize Admin SDK
        const admin = initFirebaseAdmin();
        const db = admin.firestore();

        // 2. Load Settings
        const settingsDoc = await db.collection('reminderSettings').doc('default').get();

        if (!settingsDoc.exists) {
            console.error('No settings found');
            return res.status(500).json({ error: 'Settings not configured' });
        }

        const settings = settingsDoc.data() as ReminderSettings;

        if (!settings.dailyDigestEnabled) {
            console.log('Daily digest is disabled in settings.');
            return res.status(200).json({ status: 'skipped', reason: 'disabled' });
        }

        if (!settings.dailyDigestTime) {
            console.log('No daily digest time configured.');
            return res.status(200).json({ status: 'skipped', reason: 'no_time_set' });
        }

        // 3. Fetch Data using Admin SDK
        console.log('Fetching data...');

        // Fetch campaigns
        const campaignsSnapshot = await db.collection('events').get();
        const campaigns = campaignsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Convert Firestore Timestamp to Date
                date: data.date?.toDate() || new Date(),
                createdAt: data.createdAt?.toDate() || new Date(),
            };
        }) as CalendarEvent[];

        // Fetch users
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as User[];

        // Fetch department users
        const deptUsersSnapshot = await db.collection('departmentUsers').get();
        const deptUsers = deptUsersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as DepartmentUser[];

        // 4. Process
        console.log('Data fetched. Processing digest...');
        // Pass Admin DB instance to processor
        const result = await processDailyDigest(db, campaigns, users, deptUsers, settings);

        return res.status(200).json({
            success: true,
            result
        });

    } catch (error) {
        console.error('Cron job error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
