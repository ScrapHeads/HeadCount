import { findStudentRecord } from '../../services/firestore';
import {
  signInCoachWithEmail,
  signOutCoach,
  subscribeToCoachAuth,
} from '../../services/auth';

export const loginCoach = ({ email, password }) =>
  signInCoachWithEmail({ email, password });

export const logoutCoach = () => signOutCoach();

export const watchCoachAuth = (callback) => subscribeToCoachAuth(callback);

export const loginStudent = async ({ studentId }) => {
  const studentRecord = await findStudentRecord(studentId);

  if (!studentRecord) {
    throw new Error('Student ID not found.');
  }

  if (studentRecord.active === false) {
    throw new Error('This student account is inactive.');
  }

  return {
    id: studentRecord.id,
    studentId: studentRecord.studentId ?? studentRecord.id,
    name: studentRecord.name ?? 'Student',
    ...studentRecord,
  };
};
