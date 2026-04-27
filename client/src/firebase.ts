import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { PLATFORM } from './config';

// Firebase Web API keys are not secrets — they identify the project,
// and API abuse is gated by Firebase Security Rules + App Check. This
// config points at the `spero-tcgo` project (migrated from tcn-kiosk
// on 2026-04-20 so the game has its own dedicated GCP project).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC_3fqVMEcwWAP29KOI90SCdvFOoUVozhA',
  authDomain: 'spero-tcgo-cd31a.firebaseapp.com',
  projectId: 'spero-tcgo',
  appId: '1:798283664658:web:9e0883a589f2ed7ed177cb',
  storageBucket: 'spero-tcgo.firebasestorage.app',
  messagingSenderId: '798283664658',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// iOS WKWebView's IndexedDB implementation hangs the Firebase JS SDK on
// auth state writes (the default browserLocalPersistence). Switching to
// in-memory persistence on iOS avoids the hang — the cost is the user
// re-authenticates on every cold start, but on iOS the native plugin
// preserves the credential anyway and we re-sync after launch.
if (PLATFORM === 'ios') {
  setPersistence(auth, inMemoryPersistence).catch(() => {});
}
