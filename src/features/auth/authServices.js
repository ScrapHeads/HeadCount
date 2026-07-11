import {
  findStudentRecord,
  findStudentRecordByIdentifier,
  updateStudentRecord,
} from '../../services/firestore';
import { studentAuthConfig } from '../../config/appConfig';
import { isCurrentMember } from '../../lib/studentUtils';
import {
  getCurrentAuthUser,
  isKioskAuthEmail,
  isStudentAuthEmail,
  signInCoachWithEmail,
  signInKioskWithEmail,
  signInStudentWithGeneratedEmail,
  signOutCurrentAuthUser,
  signOutStudentAuth,
  subscribeToAuthState,
} from '../../services/auth';

export { isKioskAuthEmail, isStudentAuthEmail };

// Coach, kiosk, and student accounts share Firebase Authentication. These
// checks stop one account type from entering through another account's form.
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

export const logoutCurrentAccount = () => signOutCurrentAuthUser();

export const logoutStudent = () => signOutStudentAuth();

export const watchAuthState = (callback) => subscribeToAuthState(callback);

export const loginStudent = async ({ studentId, password, requirePassword = false }) => {
  let studentAuthUser = null;
  let kioskAuthUser = null;
  let studentRecord = null;

  if (requirePassword) {
    // Direct student access signs in with the generated internal email.
    studentAuthUser = await signInStudentWithGeneratedEmail({ studentId, password });
  } else {
    // Kiosk access keeps the device's Firebase user signed in and stores only
    // the selected student's profile in the tab's student session.
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

    if (!isCurrentMember(studentRecord)) {
      throw new Error('This student is archived and cannot sign in.');
    }
  } catch (error) {
    if (studentAuthUser) {
      // Do not leave a partially authenticated student signed in when their
      // Firestore profile is missing or archived.
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
