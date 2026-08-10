import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  let credential;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credential = cert(serviceAccount);
    } catch (error) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
    }
  } else {
    // Fallback if not provided, though it will fail without GOOGLE_APPLICATION_CREDENTIALS
    credential = applicationDefault();
  }

  initializeApp({
    credential,
  });
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
