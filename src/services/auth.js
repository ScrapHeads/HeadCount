import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getApps, initializeApp } from 'firebase/app';
import { kioskAuthConfig, studentAuthConfig } from '../config/appConfig';
import { getMinimumLengthMessage } from '../lib/validators';
import { auth, firebaseConfig } from './firebase';

const studentEmailSuffix = `@${studentAuthConfig.authEmailDomain}`;
const studentManagementAppName = 'student-management';

const getStudentManagementApp = () => {
  const existingApp = getApps().find((candidateApp) => candidateApp.name === studentManagementAppName);

  return existingApp ?? initializeApp(firebaseConfig, studentManagementAppName);
};

const getStudentManagementAuth = () => getAuth(getStudentManagementApp());

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

export const isKioskAuthEmail = (email) => {
  const configuredKioskEmail = String(kioskAuthConfig.email ?? '').trim().toLowerCase();
  const normalizedEmail = String(email ?? '').trim().toLowerCase();

  return Boolean(configuredKioskEmail && normalizedEmail === configuredKioskEmail);
};

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

const mapStudentCreationError = (error) => {
  if (error?.code === 'auth/email-already-in-use') {
    throw new Error('A Firebase Authentication account already exists for this student ID.');
  }

  if (error?.code === 'auth/weak-password') {
    throw new Error(getMinimumLengthMessage(
      'Student passwords',
      studentAuthConfig.minPasswordLength,
    ));
  }

  if (error?.code === 'auth/invalid-email') {
    throw new Error('This student ID cannot be used for Firebase Authentication.');
  }

  throw error;
};

export const signInCoachWithEmail = async ({ email, password }) => {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
};

export const signInKioskWithEmail = async ({ email, password }) => {
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

export const createStudentAuthAccount = async ({ studentId, password }) => {
  if (!password) {
    throw new Error('Student password is required.');
  }

  try {
    const credential = await createUserWithEmailAndPassword(
      getStudentManagementAuth(),
      buildStudentAuthEmail(studentId),
      password,
    );

    return credential.user;
  } catch (error) {
    mapStudentCreationError(error);
  }

  return null;
};

export const deleteStudentAuthAccount = (studentAuthUser) => {
  if (!studentAuthUser) {
    return Promise.resolve();
  }

  return deleteUser(studentAuthUser);
};

export const signOutStudentManagementAuth = () => signOut(getStudentManagementAuth());

export const signOutCurrentAuthUser = () => signOut(auth);

export const signOutCoach = () => signOutCurrentAuthUser();
export const signOutKiosk = () => signOutCurrentAuthUser();

export const signOutStudentAuth = async () => {
  const currentUser = auth.currentUser;

  if (!isStudentAuthEmail(currentUser?.email)) {
    return;
  }

  await signOut(auth);
};

export const getCurrentAuthUser = () => auth.currentUser;

export const subscribeToCoachAuth = (callback) => onAuthStateChanged(auth, callback);
