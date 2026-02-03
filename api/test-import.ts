import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    try {
        // Test importing firebase-admin
        const admin = await import('firebase-admin');

        return res.status(200).json({
            success: true,
            message: 'firebase-admin imported successfully',
            hasAdmin: !!admin.default
        });
    } catch (error: any) {
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}
