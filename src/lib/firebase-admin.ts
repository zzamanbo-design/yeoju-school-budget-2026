import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  let credential;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      let keyStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      // Vercel 환경변수 복사 시 실수로 작은따옴표가 들어간 경우 제거
      if (keyStr.startsWith("'") && keyStr.endsWith("'")) {
        keyStr = keyStr.slice(1, -1);
      }
      const serviceAccount = JSON.parse(keyStr);
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
