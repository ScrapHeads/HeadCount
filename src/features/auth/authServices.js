import { findStudentRecord, updateStudentRecord } from '../../services/firestore';
import { studentAuthConfig } from '../../config/appConfig';
import {
  signInCoachWithEmail,
  signOutCoach,
  subscribeToCoachAuth,
} from '../../services/auth';

export const loginCoach = ({ email, password }) =>
  signInCoachWithEmail({ email, password });

export const logoutCoach = () => signOutCoach();

export const watchCoachAuth = (callback) => subscribeToCoachAuth(callback);

export const loginStudent = async ({ studentId, password, requirePassword = false }) => {
  const studentRecord = await findStudentRecord(studentId);

  if (!studentRecord) {
    throw new Error('Student ID not found.');
  }

  if (studentRecord.active === false) {
    throw new Error('This student account is inactive.');
  }

  if (requirePassword) {
    const storedPassword = studentRecord[studentAuthConfig.passwordField];

    if (!password) {
      throw new Error('Student password is required.');
    }

    if (storedPassword === undefined || storedPassword === null || String(storedPassword) !== password) {
      throw new Error('Student ID or password is incorrect.');
    }
  }

  return {
    id: studentRecord.id,
    studentId: studentRecord.studentId ?? studentRecord.id,
    name: studentRecord.name ?? 'Student',
    ...studentRecord,
  };
};

export const updateStudentSessionState = async ({ studentDocId, updates }) => {
  await updateStudentRecord(studentDocId, updates);
  return updates;
};
