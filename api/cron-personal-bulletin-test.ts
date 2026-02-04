/**
 * Simple test version of Personal Daily Bulletin
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // Verify Authorization
    const queryKey = Array.isArray(req.query.key) ? req.query.key[0] : req.query.key;
    const expectedKey = process.env.CRON_SECRET_KEY;

    if (queryKey !== expectedKey) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        return res.status(200).json({
            success: true,
            message: 'Personal bulletin test endpoint working!',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
