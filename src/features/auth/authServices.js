import { findStudentRecord, updateStudentRecord } from '../../services/firestore';
import { studentAuthConfig } from '../../config/appConfig';
import {
  isStudentAuthEmail,
  signInCoachWithEmail,
  signInStudentWithGeneratedEmail,
  signOutCurrentAuthUser,
  signOutCoach,
  signOutStudentAuth,
  subscribeToCoachAuth,
} from '../../services/auth';

export { isStudentAuthEmail };

export const loginCoach = async ({ email, password }) => {
  const user = await signInCoachWithEmail({ email, password });

  if (isStudentAuthEmail(user.email)) {
    await signOutCurrentAuthUser();
    throw new Error('Use the student sign-in tab for student accounts.');
  }

  return user;
};

export const logoutCoach = () => signOutCoach();

export const logoutStudent = () => signOutStudentAuth();

export const watchCoachAuth = (callback) => subscribeToCoachAuth(callback);

export const loginStudent = async ({ studentId, password, requirePassword = false }) => {
  let studentAuthUser = null;
  let studentRecord = null;

  if (requirePassword) {
    studentAuthUser = await signInStudentWithGeneratedEmail({ studentId, password });
  }

  try {
    studentRecord = await findStudentRecord(studentId);

    if (!studentRecord) {
      throw new Error('Student ID not found.');
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
    isFirebaseAuthenticated: Boolean(studentAuthUser),
  };
};

export const updateStudentSessionState = async ({ studentDocId, updates }) => {
  await updateStudentRecord(studentDocId, updates);
  return updates;
};
