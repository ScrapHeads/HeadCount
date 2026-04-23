import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase';

export const signInCoachWithEmail = async ({ email, password }) => {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
};

export const signOutCoach = () => signOut(auth);

export const subscribeToCoachAuth = (callback) => onAuthStateChanged(auth, callback);
