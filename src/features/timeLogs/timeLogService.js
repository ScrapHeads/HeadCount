import {
  collection,
  doc,
  getDoc,
  Timestamp,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { studentAuthConfig, taskConfig, timeLogConfig } from '../../config/appConfig';
import { db } from '../../services/firebase';
import { toDate } from '../../lib/dateUtils';

const calculateDurationMinutes = (signInAt, signOutAt) => {
  const startedAt = toDate(signInAt);
  const endedAt = toDate(signOutAt);

  if (!startedAt || !endedAt) {
    return null;
  }

  const elapsedMs = endedAt.getTime() - startedAt.getTime();
  return Math.max(0, Math.round(elapsedMs / 60000));
};

export const startStudentSession = async ({ student, task, signInNotes }) => {
  if (!student?.id) {
    throw new Error('A student record is required to create a time log.');
  }

  if (!task?.id) {
    throw new Error('A task is required to create a time log.');
  }

  const signInAt = Timestamp.now();
  const studentDocRef = doc(db, studentAuthConfig.collectionName, student.id);
  const timeLogDocRef = doc(collection(db, timeLogConfig.collectionName));
  const batch = writeBatch(db);

  batch.set(timeLogDocRef, {
    [timeLogConfig.studentDocIdField]: student.id,
    [timeLogConfig.studentIdField]: student.studentId ?? student.id,
    [timeLogConfig.studentNameField]: student.name ?? 'Student',
    [timeLogConfig.taskIdField]: task.id,
    [timeLogConfig.taskNameField]: task[taskConfig.nameField] ?? 'Task',
    [timeLogConfig.signInAtField]: signInAt,
    [timeLogConfig.signOutAtField]: null,
    [timeLogConfig.signInNotesField]: signInNotes,
    [timeLogConfig.signOutNotesField]: null,
    [timeLogConfig.statusField]: timeLogConfig.activeStatus,
    [timeLogConfig.durationMinutesField]: null,
    [timeLogConfig.createdAtField]: serverTimestamp(),
    [timeLogConfig.updatedAtField]: serverTimestamp(),
  });

  batch.update(studentDocRef, {
    [studentAuthConfig.currentTaskField]: task[taskConfig.nameField] ?? null,
    [studentAuthConfig.currentTaskIdField]: task.id,
    [studentAuthConfig.activeTimeLogIdField]: timeLogDocRef.id,
    [studentAuthConfig.signedInAtField]: signInAt,
    [studentAuthConfig.signedInField]: true,
  });

  await batch.commit();

  return {
    id: timeLogDocRef.id,
    signInAt,
  };
};

export const endStudentSession = async ({ studentDocId, timeLogId, signOutNotes }) => {
  if (!studentDocId) {
    throw new Error('A student record is required to complete a time log.');
  }

  if (!timeLogId) {
    throw new Error('An active time log is required to sign out.');
  }

  const timeLogDocRef = doc(db, timeLogConfig.collectionName, timeLogId);
  const existingTimeLogSnapshot = await getDoc(timeLogDocRef);

  if (!existingTimeLogSnapshot.exists()) {
    throw new Error('The active time log could not be found.');
  }

  const existingTimeLog = existingTimeLogSnapshot.data();
  const signOutAt = Timestamp.now();
  const durationMinutes = calculateDurationMinutes(
    existingTimeLog[timeLogConfig.signInAtField],
    signOutAt,
  );

  const studentDocRef = doc(db, studentAuthConfig.collectionName, studentDocId);
  const batch = writeBatch(db);

  batch.update(timeLogDocRef, {
    [timeLogConfig.signOutAtField]: signOutAt,
    [timeLogConfig.signOutNotesField]: signOutNotes,
    [timeLogConfig.statusField]: timeLogConfig.completedStatus,
    [timeLogConfig.durationMinutesField]: durationMinutes,
    [timeLogConfig.updatedAtField]: serverTimestamp(),
  });

  batch.update(studentDocRef, {
    [studentAuthConfig.currentTaskField]: null,
    [studentAuthConfig.currentTaskIdField]: null,
    [studentAuthConfig.activeTimeLogIdField]: null,
    [studentAuthConfig.signedInAtField]: null,
    [studentAuthConfig.signedInField]: false,
  });

  await batch.commit();

  return {
    id: timeLogId,
    signOutAt,
    durationMinutes,
  };
};
