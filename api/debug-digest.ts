import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

function initFirebaseAdmin() {
    if (!admin.apps.length) {
        try {
            const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
            if (!serviceAccountStr) {
                throw new Error('FIREBASE_SERVICE_ACCOUNT missing');
            }

            let serviceAccount = JSON.parse(serviceAccountStr);

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
            console.error('Firebase init error:', error);
            throw error;
        }
    }
    return admin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const adminSDK = initFirebaseAdmin();
        const db = adminSDK.firestore();

        // Get settings
        const settingsDoc = await db.collection('reminderSettings').doc('default').get();
        const settings = settingsDoc.exists ? settingsDoc.data() : null;

        // Current time info
        const now = new Date();
        const turkeyTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
        const currentHour = turkeyTime.getHours();
        const currentMinute = turkeyTime.getMinutes();

        // Parse target time
        const targetTime = settings?.dailyDigestTime || 'not set';
        let targetHour = 0;
        let targetMinute = 0;

        if (typeof targetTime === 'string' && targetTime !== 'not set') {
            [targetHour, targetMinute] = targetTime.split(':').map(Number);
        }

        // Check if it's time
        const isTime = currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);

        // Check if already sent today
        const todayStr = now.toISOString().split('T')[0];
        const logsRef = db.collection('reminderLogs');
        const snapshot = await logsRef
            .where('eventId', '==', `daily-digest-${todayStr}`)
            .where('status', '==', 'success')
            .limit(1)
            .get();
        const alreadySent = !snapshot.empty;

        // Get designer users count
        const deptUsersSnapshot = await db.collection('departmentUsers').get();
        const allDeptUsers = deptUsersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        const designerUsers = allDeptUsers.filter((user: any) => {
            const isSelected = (settings?.emailCcRecipients || []).includes(user.id);
            return user.isDesigner && user.email && isSelected;
        });

        return res.status(200).json({
            serverTime: {
                utc: now.toISOString(),
                utcHour: currentHour,
                utcMinute: currentMinute,
                localString: now.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
            },
            settings: {
                enabled: settings?.dailyDigestEnabled || false,
                targetTime: targetTime,
                targetHour,
                targetMinute,
                hasApiKey: !!settings?.resendApiKey,
            },
            checks: {
                isTime,
                alreadySentToday: alreadySent,
                todayStr,
            },
            users: {
                totalDepartmentUsers: allDeptUsers.length,
                designersWithEmail: allDeptUsers.filter((u: any) => u.isDesigner && u.email).length,
                selectedDesigners: designerUsers.length,
                selectedIds: settings?.emailCcRecipients || [],
            },
            willSend: settings?.dailyDigestEnabled && isTime && !alreadySent && designerUsers.length > 0 && !!settings?.resendApiKey,
        });
    } catch (error) {
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
}
