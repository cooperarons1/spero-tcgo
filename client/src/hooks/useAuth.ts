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
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        await migrateLocalStorageDecks(u.uid);
        await seedStarterDecks(u.uid);
      }
    });
    return unsub;
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
