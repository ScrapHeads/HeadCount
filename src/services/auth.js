import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { studentAuthConfig } from '../config/appConfig';
import { auth } from './firebase';

const studentEmailSuffix = `@${studentAuthConfig.authEmailDomain}`;

export const normalizeStudentAuthId = (studentId) => String(studentId ?? '').trim().toLowerCase();

export const buildStudentAuthEmail = (studentId) => {
  const normalizedStudentId = normalizeStudentAuthId(studentId);

  if (!normalizedStudentId) {
    throw new Error('Student ID is required.');
  }

  return `${normalizedStudentId}${studentEmailSuffix}`;
};

export const getStudentIdFromAuthEmail = (email) => {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();

  if (!normalizedEmail.endsWith(studentEmailSuffix)) {
    return null;
  }

  return normalizedEmail.slice(0, -studentEmailSuffix.length);
};

export const isStudentAuthEmail = (email) => Boolean(getStudentIdFromAuthEmail(email));

const mapStudentAuthError = (error) => {
  if (
    error?.code === 'auth/invalid-credential'
    || error?.code === 'auth/invalid-email'
    || error?.code === 'auth/user-not-found'
    || error?.code === 'auth/wrong-password'
  ) {
    throw new Error('Student ID or password is incorrect.');
  }

  throw error;
};

export const signInCoachWithEmail = async ({ email, password }) => {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
};

export const signInStudentWithGeneratedEmail = async ({ studentId, password }) => {
  if (!password) {
    throw new Error('Student password is required.');
  }

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      buildStudentAuthEmail(studentId),
      password,
    );

    return credential.user;
  } catch (error) {
    mapStudentAuthError(error);
  }

  return null;
};

export const signOutCurrentAuthUser = () => signOut(auth);

export const signOutCoach = () => signOutCurrentAuthUser();

export const signOutStudentAuth = async () => {
  if (!isStudentAuthEmail(auth.currentUser?.email)) {
    return;
  }

  await signOut(auth);
};

export const subscribeToCoachAuth = (callback) => onAuthStateChanged(auth, callback);
