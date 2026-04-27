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
    // On iOS we use in-memory persistence (IndexedDB hangs WKWebView), so
    // the user is never auto-restored on launch. Re-issue signin with the
    // credentials we stashed at the previous successful signin. If it
    // fails (revoked password, stale data), drop the cred and fall through
    // to AuthScreen.
    const cred = readNativeCred();
    if (cred) {
      void signInWithEmailAndPassword(auth, cred.email, cred.password)
        .catch(() => {
          clearNativeCred();
          clear();
        });
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
    await signInWithEmailAndPassword(auth, email, password);
    writeNativeCred(email, password);
  };

  const signOutUser = async () => {
    clearNativeCred();
    await firebaseSignOut(auth);
  };

  return { user, loading, signUp, signIn, signOut: signOutUser };
}
