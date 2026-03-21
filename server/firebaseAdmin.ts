import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
});

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
