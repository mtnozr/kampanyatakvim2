import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    return res.status(200).json({
        message: 'Hello from Vercel!',
        timestamp: new Date().toISOString(),
        env: {
            hasCronKey: !!process.env.CRON_SECRET_KEY,
            hasFirebase: !!process.env.FIREBASE_SERVICE_ACCOUNT
        }
    });
}
