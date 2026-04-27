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
import { seedStarterDecks, migrateLocalStorageDecks } from '../utils/deckStorage';

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
    // Safety net: the first onAuthStateChanged fire requires a token-
    // refresh round-trip to securetoken.googleapis.com when a session is
    // cached. On bad cellular that can stretch past 5s and the loading
    // spinner sits there with no feedback. After 3s, drop the spinner;
    // the listener still reconciles user state when it eventually fires.
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
    setUser({ ...cred.user });
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOutUser = async () => {
    await firebaseSignOut(auth);
  };

  return { user, loading, signUp, signIn, signOut: signOutUser };
}
