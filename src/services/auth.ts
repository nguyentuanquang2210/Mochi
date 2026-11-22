import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseAuth, firestore } from './firebase';

export type AuthUser = Pick<User, 'uid' | 'email' | 'displayName'>;

export function subscribeToAuth(callback: (user: AuthUser | null) => void) {
  return onAuthStateChanged(firebaseAuth, user => callback(user ? {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName
  } : null));
}

async function saveUserProfile(user: User, displayName?: string | null): Promise<void> {
  try {
    await setDoc(doc(firestore, 'users', user.uid), {
      email: user.email,
      displayName: displayName ?? user.displayName ?? null,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    // A Firestore setup/rules issue must not make a successfully-created
    // Firebase Auth account look like a failed registration.
    console.warn('Unable to save Firebase user profile:', error);
  }
}

export async function registerWithEmail(name: string, email: string, password: string): Promise<AuthUser> {
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
  const displayName = name.trim();
  if (displayName) await updateProfile(credential.user, { displayName });
  void saveUserProfile(credential.user, displayName || null);
  return { uid: credential.user.uid, email: credential.user.email, displayName: displayName || null };
}

export async function loginWithEmail(email: string, password: string): Promise<AuthUser> {
  const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  void saveUserProfile(credential.user);
  return { uid: credential.user.uid, email: credential.user.email, displayName: credential.user.displayName };
}

export const logout = () => signOut(firebaseAuth);
