import {
  findStudentRecord,
  findStudentRecordByIdentifier,
  updateStudentRecord,
} from '../../services/firestore';
import { studentAuthConfig } from '../../config/appConfig';
import {
  getCurrentAuthUser,
  isKioskAuthEmail,
  isStudentAuthEmail,
  signInCoachWithEmail,
  signInKioskWithEmail,
  signInStudentWithGeneratedEmail,
  signOutCurrentAuthUser,
  signOutCoach,
  signOutKiosk,
  signOutStudentAuth,
  subscribeToCoachAuth,
} from '../../services/auth';

export { isKioskAuthEmail, isStudentAuthEmail };

export const loginCoach = async ({ email, password }) => {
  const user = await signInCoachWithEmail({ email, password });

  if (isStudentAuthEmail(user.email)) {
    await signOutCurrentAuthUser();
    throw new Error('Use the student sign-in tab for student accounts.');
  }

  if (isKioskAuthEmail(user.email)) {
    await signOutCurrentAuthUser();
    throw new Error('Use kiosk setup for the kiosk account.');
  }

  return user;
};

export const loginKiosk = async ({ email, password }) => {
  const user = await signInKioskWithEmail({ email, password });

  if (!isKioskAuthEmail(user.email)) {
    await signOutCurrentAuthUser();
    throw new Error('This Firebase user is not configured as the kiosk account.');
  }

  return user;
};

export const logoutCoach = () => signOutCoach();

export const logoutKiosk = () => signOutKiosk();

export const logoutStudent = () => signOutStudentAuth();

export const watchCoachAuth = (callback) => subscribeToCoachAuth(callback);

export const loginStudent = async ({ studentId, password, requirePassword = false }) => {
  let studentAuthUser = null;
  let kioskAuthUser = null;
  let studentRecord = null;

  if (requirePassword) {
    studentAuthUser = await signInStudentWithGeneratedEmail({ studentId, password });
  } else {
    kioskAuthUser = getCurrentAuthUser();

    if (!isKioskAuthEmail(kioskAuthUser?.email)) {
      throw new Error('This device must be signed in as the student kiosk before students can enter an ID or scan a card.');
    }
  }

  try {
    studentRecord = requirePassword
      ? await findStudentRecord(studentId)
      : await findStudentRecordByIdentifier(studentId);

    if (!studentRecord) {
      throw new Error(requirePassword
        ? 'Student ID not found.'
        : 'Student ID or NFC card ID not found.');
    }

    if (studentRecord.active === false) {
      throw new Error('This student account is inactive.');
    }
  } catch (error) {
    if (studentAuthUser) {
      await signOutStudentAuth().catch(() => {});
    }

    throw error;
  }

  return {
    ...studentRecord,
    id: studentRecord.id,
    studentId: studentRecord[studentAuthConfig.idField] ?? studentRecord.studentId ?? studentRecord.id,
    name: studentRecord.name ?? 'Student',
    authEmail: studentAuthUser?.email ?? null,
    authUid: studentAuthUser?.uid ?? null,
    authMode: studentAuthUser ? 'student' : 'kiosk',
    isFirebaseAuthenticated: Boolean(studentAuthUser),
    kioskAuthEmail: kioskAuthUser?.email ?? null,
    kioskAuthUid: kioskAuthUser?.uid ?? null,
  };
};

export const updateStudentSessionState = async ({ studentDocId, updates }) => {
  await updateStudentRecord(studentDocId, updates);
  return updates;
};
