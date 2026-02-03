import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    try {
        // Step 1: Import
        const { initFirebaseAdmin } = await import('./lib/firebaseAdmin');

        // Step 2: Initialize
        const admin = initFirebaseAdmin();

        return res.status(200).json({
            success: true,
            message: 'Firebase Admin initialized successfully',
            hasFirestore: !!admin.firestore
        });
    } catch (error: any) {
        return res.status(500).json({
            error: error.message,
            stack: error.stack?.substring(0, 500)
        });
    }
}
