import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { PLATFORM } from '../config';
import { seedStarterDecks, migrateLocalStorageDecks } from '../utils/deckStorage';

// Pair with iOS in-memory persistence in firebase.ts: on native, we stash
// the user's email/password in localStorage so `useAuth` can auto-signin
// at app launch. Web/Electron keep using Firebase's default localStorage
// persistence and never read this key. The credentials never leave the
// device — same trust model as a saved iCloud Keychain login on web.
const NATIVE_CRED_KEY = 'spero.tcg.nativeCred.v1';
const REST_TOKEN_KEY = 'spero.tcg.restToken.v1';

// API key has to match firebase.ts. Firebase Web API keys are not secrets.
const FIREBASE_API_KEY = (import.meta as any).env?.VITE_FIREBASE_API_KEY ||
  'AIzaSyC_3fqVMEcwWAP29KOI90SCdvFOoUVozhA';

// Direct REST signin against Identity Toolkit. Returns the same shape as
// Firebase's response. Used as a fallback on iOS where the JS SDK's
// signInWithEmailAndPassword hangs inside WKWebView (root cause unknown,
// suspected internal iframe / cookie state). The reachability probe in
// AuthScreen confirms the network path itself is fine.
async function restSignIn(email: string, password: string) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const body = await res.json();
  if (!res.ok) {
    const code = body?.error?.message || 'UNKNOWN_ERROR';
    const err: any = new Error(code);
    // Map Identity Toolkit error names → Firebase Auth error codes the
    // existing AuthScreen handler already understands.
    if (code === 'INVALID_LOGIN_CREDENTIALS' || code === 'INVALID_PASSWORD' || code === 'EMAIL_NOT_FOUND') {
      err.code = 'auth/invalid-credential';
    } else if (code === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
      err.code = 'auth/too-many-requests';
    } else if (code === 'USER_DISABLED') {
      err.code = 'auth/user-disabled';
    }
    throw err;
  }
  return body as {
    idToken: string; refreshToken: string; expiresIn: string;
    localId: string; email: string; displayName?: string;
  };
}

function persistRestToken(t: { idToken: string; refreshToken: string; localId: string; email: string; displayName?: string }) {
  try {
    localStorage.setItem(REST_TOKEN_KEY, JSON.stringify({
      uid: t.localId, email: t.email, displayName: t.displayName ?? '',
      idToken: t.idToken, refreshToken: t.refreshToken,
      issuedAt: Date.now(),
    }));
  } catch {}
}

// Synthesize a minimal User-shaped object so App + socket consumers that
// read `user.uid / .email / .displayName / .getIdToken()` keep working.
function syntheticUser(t: { idToken: string; refreshToken: string; localId: string; email: string; displayName?: string }): User {
  return {
    uid: t.localId,
    email: t.email,
    displayName: t.displayName ?? null,
    emailVerified: false,
    isAnonymous: false,
    providerData: [],
    metadata: {} as any,
    refreshToken: t.refreshToken,
    tenantId: null,
    phoneNumber: null,
    photoURL: null,
    providerId: 'password',
    delete: async () => {},
    getIdToken: async () => t.idToken,
    getIdTokenResult: async () => ({ token: t.idToken, claims: {}, authTime: '', issuedAtTime: '', expirationTime: '', signInProvider: 'password', signInSecondFactor: null } as any),
    reload: async () => {},
    toJSON: () => ({}),
  } as unknown as User;
}
const readNativeCred = (): { email: string; password: string } | null => {
  if (PLATFORM !== 'ios') return null;
  try {
    const raw = localStorage.getItem(NATIVE_CRED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const writeNativeCred = (email: string, password: string) => {
  if (PLATFORM !== 'ios') return;
  try { localStorage.setItem(NATIVE_CRED_KEY, JSON.stringify({ email, password })); } catch {}
};
const clearNativeCred = () => {
  try { localStorage.removeItem(NATIVE_CRED_KEY); } catch {}
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cleared = false;
    const clear = () => {
      if (cleared) return;
      cleared = true;
      setLoading(false);
    };
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      clear();
      if (u) {
        await migrateLocalStorageDecks(u.uid);
        await seedStarterDecks(u.uid);
      }
    });
    // On iOS we use direct REST signin (the Firebase JS SDK hangs in
    // WKWebView). At launch, prefer a previously-persisted REST token so
    // the user gets straight into the lobby; fall back to the stashed
    // email/password to refresh the token.
    if (PLATFORM === 'ios') {
      try {
        const raw = localStorage.getItem(REST_TOKEN_KEY);
        if (raw) {
          const t = JSON.parse(raw);
          setUser(syntheticUser({
            idToken: t.idToken, refreshToken: t.refreshToken,
            localId: t.uid, email: t.email, displayName: t.displayName,
          }));
          clear();
        }
      } catch {}
      const cred = readNativeCred();
      if (cred) {
        void restSignIn(cred.email, cred.password).then((tok) => {
          persistRestToken(tok);
          setUser(syntheticUser(tok));
          clear();
        }).catch(() => {
          clearNativeCred();
          clear();
        });
      }
    }
    // Safety net: drop the spinner after 3s no matter what so the user
    // always reaches a usable screen even if Firebase init hangs.
    const t = setTimeout(clear, 3000);
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await seedStarterDecks(cred.user.uid);
    writeNativeCred(email, password);
    setUser({ ...cred.user });
  };

  const signIn = async (email: string, password: string) => {
    if (PLATFORM === 'ios') {
      const tok = await restSignIn(email, password);
      persistRestToken(tok);
      writeNativeCred(email, password);
      setUser(syntheticUser(tok));
      return;
    }
    await signInWithEmailAndPassword(auth, email, password);
    writeNativeCred(email, password);
  };

  const signOutUser = async () => {
    clearNativeCred();
    try { localStorage.removeItem(REST_TOKEN_KEY); } catch {}
    setUser(null);
    if (PLATFORM !== 'ios') await firebaseSignOut(auth);
  };

  return { user, loading, signUp, signIn, signOut: signOutUser };
}
