import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

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

  // Initialize Firebase Admin inside handler to catch errors gracefully
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
        // First, unescape double escapes if present
        let key = rawKey.replace(/\\n/g, '\n');
        
        // If it doesn't look like a PEM (no newlines, or just one line), fix it
        // Standard PEM has -----BEGIN... and newlines.
        // If we have headers but no newlines, or headers and messed up spacing:
        
        // Extract the body (everything between the headers)
        const match = key.match(/-----BEGIN PRIVATE KEY-----([\s\S]*)-----END PRIVATE KEY-----/);
        if (match && match[1]) {
            // Found body. Remove all whitespace from body.
            const body = match[1].replace(/\s/g, '');
            // Reconstruct
            key = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
        }
        
        serviceAccount.private_key = key;
      }
  
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (error: any) {
      console.error('Firebase Admin Initialization Error:', error);
      return res.status(500).json({ 
        error: `Firebase Admin Init Failed: ${error.message}` 
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, uid, email, password } = req.body;

    if (action === 'createUser') {
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required for creation' });
      }

      try {
        const userRecord = await admin.auth().createUser({
          email: email,
          password: password,
        });
        
        // Return project ID and service account email for verification
        let projectId = 'unknown';
        let serviceAccountEmail = 'unknown';

        try {
            // Strategy 1: Check Environment Variable (Source of Truth)
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                 const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                 if (sa.project_id) projectId = sa.project_id;
                 if (sa.client_email) serviceAccountEmail = sa.client_email;
            }
            
            // Strategy 2: Check Active Admin App Credential
            if (projectId === 'unknown' && admin.apps.length > 0) {
                const cert = (admin.app().options.credential as any)?.certificate;
                if (cert) {
                    if (cert.projectId) projectId = cert.projectId;
                    if (cert.clientEmail) serviceAccountEmail = cert.clientEmail;
                } else if (admin.app().options.projectId) {
                    projectId = admin.app().options.projectId;
                }
            }
        } catch (e) {
            console.error('Error extracting project ID:', e);
        }

        return res.status(200).json({ 
            uid: userRecord.uid, 
            message: 'User created successfully',
            projectId,
            serviceAccountEmail
        });
      } catch (error: any) {
        // If user already exists, we might want to return that info or handle it
        if (error.code === 'auth/email-already-exists') {
             // Optional: Update the password if it already exists?
             // For now, let's just fail or return the existing user if we wanted to be idempotent
             // But standard behavior is to error.
             return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanımda.', code: error.code });
        }
        throw error;
      }
    }

    if (action === 'updateUser') {
      if (!uid) {
        return res.status(400).json({ error: 'UID required for update' });
      }

      const updates: any = {};
      if (email) updates.email = email;
      if (password) updates.password = password;

      if (Object.keys(updates).length === 0) {
        return res.status(200).json({ message: 'No updates provided' });
      }

      try {
        await admin.auth().updateUser(uid, updates);
        return res.status(200).json({ message: 'User updated successfully' });
      } catch (error: any) {
        return res.status(400).json({ error: error.message || 'Update failed' });
      }
    }

    if (action === 'deleteUser') {
      if (uid) {
        try {
          await admin.auth().deleteUser(uid);
          return res.status(200).json({ message: 'User deleted successfully by UID' });
        } catch (error: any) {
          if (error.code === 'auth/user-not-found') {
            return res.status(200).json({ message: 'User not found, nothing to delete' });
          }
          throw error;
        }
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
