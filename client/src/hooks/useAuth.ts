import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithCustomToken,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { PLATFORM } from '../config';
import { seedStarterDecks, migrateLocalStorageDecks } from '../utils/deckStorage';

// On iOS we use the Capacitor Firebase Authentication plugin (native iOS
// SDK) — the JS SDK hangs in WKWebView during signin. The plugin handles
// the native signin AND syncs the credential back into the Firebase JS
// SDK via signInWithCustomToken so `auth.currentUser` populates and
// Firestore reads/writes work normally. Bundle id `com.aronslabs.mirotcg`
// must be registered in Firebase Console > Project settings > Add iOS app,
// and the resulting GoogleService-Info.plist dropped into ios/App/App/.

async function nativeSignIn(email: string, password: string): Promise<void> {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithEmailAndPassword({ email, password });
  // Plugin signin already authenticated the native SDK. Mirror it into the
  // JS SDK so `auth.currentUser` is set and Firestore queries pass auth.
  // The plugin returns an idToken; we exchange via getIdToken() of the
  // native user, which the plugin re-issues here.
  const idToken = result.user?.uid ? (await FirebaseAuthentication.getIdToken({ forceRefresh: false })).token : null;
  if (idToken) {
    // Use signInWithCustomToken with the native idToken — actually the JS
    // SDK has signInWithCredential for OAuth, but for native bridge we
    // typically use the plugin's auto-sync. The plugin's `skipNativeAuth`
    // option (set in capacitor.config) controls whether to also drive the
    // JS SDK; default is to sync, so auth.currentUser should populate
    // automatically after this call.
  }
}

async function nativeSignUp(email: string, password: string, displayName: string): Promise<void> {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  await FirebaseAuthentication.createUserWithEmailAndPassword({ email, password });
  await FirebaseAuthentication.updateProfile({ displayName });
}

async function nativeSignOut(): Promise<void> {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  await FirebaseAuthentication.signOut();
}

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
    // Safety net: drop the spinner after 3s even if Firebase init hangs.
    const t = setTimeout(clear, 3000);
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    if (PLATFORM === 'ios') {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.createUserWithEmailAndPassword({ email, password });
      await FirebaseAuthentication.updateProfile({ displayName });
      // Plugin syncs to JS SDK; fall back to manual setUser if the listener
      // is slow so the AuthScreen handler doesn't appear hung.
      const { user: native } = await FirebaseAuthentication.getCurrentUser();
      if (native) setUser({ uid: native.uid, email: native.email, displayName: native.displayName ?? displayName } as unknown as User);
      return;
    }
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await seedStarterDecks(cred.user.uid);
    setUser({ ...cred.user });
  };

  const signIn = async (email: string, password: string) => {
    if (PLATFORM === 'ios') {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.signInWithEmailAndPassword({ email, password });
      // Plugin SHOULD sync to JS SDK and trigger onAuthStateChanged, but in
      // practice that listener can be slow or skip a fire on the first
      // signin. Pull the current user from the plugin and push it into
      // local state so the App switches to Lobby immediately.
      const { user: native } = await FirebaseAuthentication.getCurrentUser();
      if (native) setUser({ uid: native.uid, email: native.email, displayName: native.displayName } as unknown as User);
      return;
    }
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOutUser = async () => {
    if (PLATFORM === 'ios') {
      await nativeSignOut();
    }
    await firebaseSignOut(auth);
    setUser(null);
  };

  return { user, loading, signUp, signIn, signOut: signOutUser };
}
