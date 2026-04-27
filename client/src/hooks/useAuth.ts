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

    // On iOS, also restore the native plugin's session at app launch so the
    // user doesn't have to log back in after every cold start. The JS SDK
    // listener above won't fire on iOS (we use REST for Firestore), so we
    // mirror the native user into React state here.
    if (PLATFORM === 'ios') {
      (async () => {
        try {
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          const { user: native } = await FirebaseAuthentication.getCurrentUser();
          if (native) {
            setUser({ uid: native.uid, email: native.email, displayName: native.displayName } as unknown as User);
            // Seed starter decks in the background — this hits the REST
            // adapter on iOS so it doesn't depend on the JS SDK auth.
            (async () => {
              try {
                await migrateLocalStorageDecks(native.uid);
                await seedStarterDecks(native.uid);
              } catch (e) {
                console.error('[auth] iOS deck seeding failed', e);
              }
            })();
          }
          clear();
        } catch (e) {
          console.warn('[auth] iOS native getCurrentUser failed', e);
          clear();
        }
      })();
    }

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
      const { user: native } = await FirebaseAuthentication.getCurrentUser();
      if (native) {
        setUser({ uid: native.uid, email: native.email, displayName: native.displayName ?? displayName } as unknown as User);
        // Seed via REST adapter (uses native idToken — no JS SDK dependency).
        try { await seedStarterDecks(native.uid); } catch (e) { console.error('[auth] seedStarterDecks failed', e); }
      }
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
      const { user: native } = await FirebaseAuthentication.getCurrentUser();
      if (native) {
        setUser({ uid: native.uid, email: native.email, displayName: native.displayName } as unknown as User);
        try {
          await migrateLocalStorageDecks(native.uid);
          await seedStarterDecks(native.uid);
        } catch (e) {
          console.error('[auth] iOS deck seeding failed', e);
        }
      }
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
