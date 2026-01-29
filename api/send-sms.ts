/**
 * Vercel Serverless Function
 * Twilio API'yi güvenli şekilde backend'den çağırır
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountSid, authToken, fromNumber, toNumber, message } = req.body;

    // Validate inputs
    if (!accountSid || !authToken || !fromNumber || !toNumber || !message) {
      return res.status(400).json({
        error: 'Missing required fields: accountSid, authToken, fromNumber, toNumber, message'
      });
    }

    // Create basic auth header
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    // Call Twilio API
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: toNumber,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Twilio API error:', error);
      return res.status(response.status).json({
        success: false,
        error: error.message || 'SMS gönderilemedi',
      });
    }

    const data = await response.json();
    return res.status(200).json({
      success: true,
      messageSid: data.sid,
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });
  }
}
