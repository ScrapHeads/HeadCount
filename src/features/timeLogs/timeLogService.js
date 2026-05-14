import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  writeBatch,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { studentAuthConfig, taskConfig, timeLogConfig } from '../../config/appConfig';
import { db } from '../../services/firebase';
import { toDate } from '../../lib/dateUtils';

// Duration is stored as a convenience field for analytics. We still keep the
// raw timestamps so teams can recalculate later if they want different rules.
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

  // Create the historical record and update the student's live session state
  // together so the app does not end up with an active log but no active
  // student session, or the reverse.
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

  // Sign-out clears the live student fields in the same batch that closes the
  // log. That keeps the coach dashboard and reporting views consistent.
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

// Coaches use the same close-session flow as students, but with a generated
// note so the historical log shows the session was ended from the dashboard.
export const endStudentSessionByCoach = async ({ student, coachEmail }) => {
  if (!student?.id) {
    throw new Error('A student record is required to end a session.');
  }

  const timeLogId = student[studentAuthConfig.activeTimeLogIdField];

  if (!timeLogId) {
    throw new Error('This student does not have an active time log.');
  }

  const noteSuffix = coachEmail ? ` by ${coachEmail}` : '';
  return endStudentSession({
    studentDocId: student.id,
    timeLogId,
    signOutNotes: `Session ended from coach dashboard${noteSuffix}.`,
  });
};

export const listTimeLogsBySignInRange = async ({ startDate, endDate }) => {
  const start = toDate(startDate);
  const end = toDate(endDate);

  if (!start || !end) {
    throw new Error('A valid start and end date are required to load analytics.');
  }

  const timeLogsQuery = query(
    collection(db, timeLogConfig.collectionName),
    where(timeLogConfig.signInAtField, '>=', Timestamp.fromDate(start)),
    where(timeLogConfig.signInAtField, '<=', Timestamp.fromDate(end)),
    orderBy(timeLogConfig.signInAtField, 'asc'),
  );
  const timeLogsSnapshot = await getDocs(timeLogsQuery);

  return timeLogsSnapshot.docs.map((timeLogDoc) => ({
    id: timeLogDoc.id,
    ...timeLogDoc.data(),
  }));
};
