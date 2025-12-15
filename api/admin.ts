import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
// We expect the service account to be passed as a JSON string in the environment variable
if (!admin.apps.length) {
  try {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT || '{}';
    // Handle potential double-escaped newlines if copied from certain sources
    const serviceAccount = JSON.parse(serviceAccountStr);
    
    // Fix private_key newlines if they are escaped literal "\n"
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      
      // Robust fix for PEM formatting issues (spaces, missing newlines)
      if (!serviceAccount.private_key.includes('\n') && serviceAccount.private_key.includes('PRIVATE KEY')) {
         // It might be a single line blob due to copy-paste. Try to normalize.
         const parts = serviceAccount.private_key.split('-----');
         // Expected parts: ["", "BEGIN PRIVATE KEY", "BODY", "END PRIVATE KEY", ""] or similar
         // Find the part that is the body (longest part usually, or the middle one)
         if (parts.length >= 5) {
            const body = parts[2].replace(/\s/g, '');
            serviceAccount.private_key = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
         }
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
    // Don't crash here, let the handler fail if needed, so we can return a proper error response
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Check if Admin was initialized
  if (!admin.apps.length) {
    return res.status(500).json({ 
      error: 'Firebase Admin not initialized. Check server logs and environment variables.' 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, uid, email } = req.body;

    if (action === 'deleteUser') {
      if (uid) {
        await admin.auth().deleteUser(uid);
        return res.status(200).json({ message: 'User deleted successfully by UID' });
      } 
      
      if (email) {
        try {
          const user = await admin.auth().getUserByEmail(email);
          await admin.auth().deleteUser(user.uid);
          return res.status(200).json({ message: 'User deleted successfully by Email' });
        } catch (error: any) {
          if (error.code === 'auth/user-not-found') {
            return res.status(200).json({ message: 'User not found, nothing to delete' });
          }
          throw error;
        }
      }

      return res.status(400).json({ error: 'UID or Email required for deletion' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
