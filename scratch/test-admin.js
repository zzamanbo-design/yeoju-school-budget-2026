const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try {
  console.log("Key length:", process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? process.env.FIREBASE_SERVICE_ACCOUNT_KEY.length : 0);
  console.log("Starts with:", process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.substring(0, 5));
  console.log("Ends with:", process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.substring(process.env.FIREBASE_SERVICE_ACCOUNT_KEY.length - 5));
  
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  console.log("Parsed project ID:", serviceAccount.project_id);
  
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  }
  const db = getFirestore();
  console.log("Firestore initialized.");
} catch (e) {
  console.error(e);
}
