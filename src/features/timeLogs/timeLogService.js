import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { studentAuthConfig, taskConfig, timeLogConfig } from '../../config/appConfig';
import { getScheduledTaskEndTime } from '../schedules/validateSchedule';
import { getCurrentAuthUser, getStudentIdFromAuthEmail } from '../../services/auth';
import { db } from '../../services/firebase';
import {
  MILLISECONDS_PER_MINUTE,
  MINUTES_PER_HOUR,
} from '../../lib/constants';
import { toDate } from '../../lib/dateUtils';
import { getStudentIdHistory, isCurrentMember } from '../../lib/studentUtils';
import { isNumericString, nullableString } from '../../lib/validators';

// Duration is stored as a convenience field for analytics. We still keep the
// raw timestamps so teams can recalculate later if they want different rules.
const calculateDurationMinutes = (signInAt, signOutAt) => {
  const startedAt = toDate(signInAt);
  const endedAt = toDate(signOutAt);

  if (!startedAt || !endedAt) {
    return null;
  }

  const elapsedMs = endedAt.getTime() - startedAt.getTime();
  return Math.max(0, Math.round(elapsedMs / MILLISECONDS_PER_MINUTE));
};

const getStudentLogIdCandidates = (student) => {
  const candidates = new Set();

  getStudentIdHistory(student).forEach((value) => {
    const stringValue = String(value ?? '').trim();

    if (!stringValue) {
      return;
    }

    candidates.add(stringValue);

    // Some older Firestore records stored numeric IDs as numbers instead of
    // strings, so query both forms when the ID can be parsed safely.
    if (studentAuthConfig.idValueType === 'auto' && isNumericString(stringValue)) {
      candidates.add(Number(stringValue));
    }
  });

  return [...candidates];
};

const sortLogsByNewestSignIn = (logs) => [...logs].sort((left, right) => {
  const leftTime = (
    toDate(left?.[timeLogConfig.signInAtField])
    ?? toDate(left?.[timeLogConfig.createdAtField])
  )?.getTime() ?? 0;
  const rightTime = (
    toDate(right?.[timeLogConfig.signInAtField])
    ?? toDate(right?.[timeLogConfig.createdAtField])
  )?.getTime() ?? 0;

  return rightTime - leftTime;
});

export const listTimeLogsForStudent = async ({ student }) => {
  if (!student?.id && !getStudentLogIdCandidates(student).length) {
    throw new Error('A student record is required to load time logs.');
  }

  const logsById = new Map();
  const timeLogsCollection = collection(db, timeLogConfig.collectionName);
  const queryRequests = [];
  const authenticatedStudentId = getStudentIdFromAuthEmail(getCurrentAuthUser()?.email);

  if (authenticatedStudentId) {
    // The stable document ID includes modern sessions created under previous
    // Student IDs.
    if (student?.id) {
      queryRequests.push({
        isOptional: false,
        timeLogsQuery: query(
          timeLogsCollection,
          where(timeLogConfig.studentDocIdField, '==', student.id),
        ),
      });
    }

    // Also query the current and previous IDs for older or imported logs. The
    // security rules confirm that returned logs point to this student profile.
    const studentIdCandidates = new Set([
      authenticatedStudentId,
      ...getStudentLogIdCandidates(student),
    ]);

    studentIdCandidates.forEach((studentId) => {
      queryRequests.push({
        // A legacy query may be rejected when an imported log is missing its
        // stable studentDocId. It should not hide records from required reads.
        isOptional: studentId !== authenticatedStudentId,
        timeLogsQuery: query(
          timeLogsCollection,
          where(timeLogConfig.studentIdField, '==', studentId),
        ),
      });
    });
  } else {
    if (student?.id) {
      queryRequests.push({
        isOptional: false,
        timeLogsQuery: query(
          timeLogsCollection,
          where(timeLogConfig.studentDocIdField, '==', student.id),
        ),
      });
    }

    getStudentLogIdCandidates(student).forEach((studentId) => {
      queryRequests.push({
        isOptional: false,
        timeLogsQuery: query(
          timeLogsCollection,
          where(timeLogConfig.studentIdField, '==', studentId),
        ),
      });
    });
  }

  const queryResults = await Promise.allSettled(
    queryRequests.map(({ timeLogsQuery }) => getDocs(timeLogsQuery)),
  );
  const requiredFailure = queryResults.find(
    (result, index) => result.status === 'rejected' && !queryRequests[index].isOptional,
  );

  if (requiredFailure) {
    throw requiredFailure.reason;
  }

  // Multiple compatibility queries can return the same log. The document ID
  // map removes duplicates before the timeline is sorted.
  queryResults.forEach((result) => {
    if (result.status !== 'fulfilled') {
      return;
    }

    result.value.docs.forEach((timeLogDoc) => {
      logsById.set(timeLogDoc.id, {
        id: timeLogDoc.id,
        ...timeLogDoc.data(),
      });
    });
  });

  return sortLogsByNewestSignIn([...logsById.values()]);
};

export const updateTimeLogByCoach = async ({
  signInAt,
  signInNotes,
  signOutAt,
  signOutNotes,
  student,
  taskName,
  timeLogId,
}) => {
  if (!timeLogId) {
    throw new Error('A time log is required for updates.');
  }

  const signInDate = toDate(signInAt);
  const signOutDate = signOutAt ? toDate(signOutAt) : null;
  const trimmedTaskName = String(taskName ?? '').trim();

  if (!signInDate) {
    throw new Error('Start time must be a valid date and time.');
  }

  if (signOutAt && !signOutDate) {
    throw new Error('End time must be a valid date and time.');
  }

  if (signOutDate && signOutDate < signInDate) {
    throw new Error('End time must be after start time.');
  }

  if (!trimmedTaskName) {
    throw new Error('Task name is required.');
  }

  const timeLogDocRef = doc(db, timeLogConfig.collectionName, timeLogId);
  const existingTimeLogSnapshot = await getDoc(timeLogDocRef);

  if (!existingTimeLogSnapshot.exists()) {
    throw new Error('The time log could not be found.');
  }

  const existingTimeLog = existingTimeLogSnapshot.data();
  const isSelectedStudentActiveLog = student?.[studentAuthConfig.activeTimeLogIdField] === timeLogId;

  if (
    !signOutDate
    && existingTimeLog[timeLogConfig.statusField] === timeLogConfig.completedStatus
    && !isSelectedStudentActiveLog
  ) {
    throw new Error('Completed logs need an end time.');
  }

  const signInTimestamp = Timestamp.fromDate(signInDate);
  const signOutTimestamp = signOutDate ? Timestamp.fromDate(signOutDate) : null;
  const durationMinutes = signOutDate ? calculateDurationMinutes(signInDate, signOutDate) : null;
  const batch = writeBatch(db);

  batch.update(timeLogDocRef, {
    [timeLogConfig.signInAtField]: signInTimestamp,
    [timeLogConfig.signOutAtField]: signOutTimestamp,
    [timeLogConfig.signInNotesField]: nullableString(signInNotes),
    [timeLogConfig.signOutNotesField]: nullableString(signOutNotes),
    [timeLogConfig.taskNameField]: trimmedTaskName,
    [timeLogConfig.statusField]: signOutDate ? timeLogConfig.completedStatus : timeLogConfig.activeStatus,
    [timeLogConfig.durationMinutesField]: durationMinutes,
    [timeLogConfig.updatedAtField]: serverTimestamp(),
  });

  if (isSelectedStudentActiveLog) {
    // Editing the currently active log must also update the live student card,
    // otherwise the dashboard would show different task or sign-in details.
    const studentDocRef = doc(db, studentAuthConfig.collectionName, student.id);

    batch.update(studentDocRef, signOutDate
      ? {
        [studentAuthConfig.currentTaskField]: null,
        [studentAuthConfig.currentTaskIdField]: null,
        [studentAuthConfig.activeTimeLogIdField]: null,
        [studentAuthConfig.signedInAtField]: null,
        [studentAuthConfig.signedInField]: false,
      }
      : {
        [studentAuthConfig.currentTaskField]: trimmedTaskName,
        [studentAuthConfig.signedInAtField]: signInTimestamp,
        [studentAuthConfig.signedInField]: true,
      });
  }

  await batch.commit();

  return {
    id: timeLogId,
    durationMinutes,
    signInAt: signInTimestamp,
    signOutAt: signOutTimestamp,
  };
};

export const createExtraHoursTimeLog = async ({
  enteredBy,
  hours,
  reason,
  student,
}) => {
  if (!student?.id) {
    throw new Error('A student record is required to add extra hours.');
  }

  if (!isCurrentMember(student)) {
    throw new Error('Archived students cannot receive extra hours.');
  }

  const numericHours = Number(hours);
  const trimmedReason = String(reason ?? '').trim();

  if (!Number.isFinite(numericHours) || numericHours <= 0) {
    throw new Error('Extra hours must be greater than zero.');
  }

  if (!trimmedReason) {
    throw new Error('A reason is required to add extra hours.');
  }

  const durationMinutes = Math.round(numericHours * MINUTES_PER_HOUR);
  const timeLogDocRef = doc(collection(db, timeLogConfig.collectionName));
  const studentId = student[studentAuthConfig.idField] ?? student.studentId ?? student.id;
  const batch = writeBatch(db);

  batch.set(timeLogDocRef, {
    [timeLogConfig.createdAtField]: serverTimestamp(),
    [timeLogConfig.updatedAtField]: serverTimestamp(),
    [timeLogConfig.durationMinutesField]: durationMinutes,
    [timeLogConfig.studentDocIdField]: student.id,
    [timeLogConfig.studentIdField]: studentId,
    [timeLogConfig.studentNameField]: student.name ?? 'Student',
    [timeLogConfig.statusField]: timeLogConfig.completedStatus,
    [timeLogConfig.taskNameField]: timeLogConfig.extraTimeTaskName,
    [timeLogConfig.reasonField]: trimmedReason,
    [timeLogConfig.enteredByField]: nullableString(enteredBy) ?? 'Coach',
  });

  await batch.commit();

  return {
    id: timeLogDocRef.id,
    durationMinutes,
  };
};

export const startStudentSession = async ({ student, task, signInNotes }) => {
  if (!student?.id) {
    throw new Error('A student record is required to create a time log.');
  }

  if (!isCurrentMember(student)) {
    throw new Error('Archived students cannot be signed in.');
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

export const endStudentSession = async ({
  studentDocId,
  timeLogId,
  signOutAt = null,
  signOutNotes,
}) => {
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
  const signInDate = toDate(existingTimeLog[timeLogConfig.signInAtField]);
  const signOutDate = signOutAt ? toDate(signOutAt) : new Date();

  if (!signOutDate) {
    throw new Error('The sign-out time is invalid.');
  }

  if (signInDate && signOutDate < signInDate) {
    throw new Error('The sign-out time cannot be before the sign-in time.');
  }

  const signOutTimestamp = Timestamp.fromDate(signOutDate);
  const durationMinutes = calculateDurationMinutes(
    existingTimeLog[timeLogConfig.signInAtField],
    signOutTimestamp,
  );

  const studentDocRef = doc(db, studentAuthConfig.collectionName, studentDocId);
  const batch = writeBatch(db);

  // Sign-out clears the live student fields in the same batch that closes the
  // log. That keeps the coach dashboard and reporting views consistent.
  batch.update(timeLogDocRef, {
    [timeLogConfig.signOutAtField]: signOutTimestamp,
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
    signOutAt: signOutTimestamp,
    durationMinutes,
  };
};

export const endStaleStudentSession = async ({
  now = new Date(),
  schedules = [],
  student,
}) => {
  const timeLogId = student?.[studentAuthConfig.activeTimeLogIdField];

  if (!student?.id || !timeLogId) {
    return false;
  }

  const timeLogDocRef = doc(db, timeLogConfig.collectionName, timeLogId);
  const timeLogSnapshot = await getDoc(timeLogDocRef);

  if (!timeLogSnapshot.exists()) {
    return false;
  }

  const timeLog = timeLogSnapshot.data();

  if (timeLog[timeLogConfig.statusField] !== timeLogConfig.activeStatus) {
    return false;
  }

  const signInAt = toDate(timeLog[timeLogConfig.signInAtField]);
  const currentTime = toDate(now);

  if (!signInAt || !currentTime) {
    return false;
  }

  const midnightAfterSignIn = new Date(signInAt);
  midnightAfterSignIn.setHours(24, 0, 0, 0);

  // Automatic cleanup waits until the next calendar day. It then closes the
  // log at the scheduled end time rather than incorrectly counting overnight.
  if (currentTime < midnightAfterSignIn) {
    return false;
  }

  const scheduledEndTime = getScheduledTaskEndTime({
    schedules,
    taskId: timeLog[timeLogConfig.taskIdField],
    time: signInAt,
  });

  if (!scheduledEndTime || scheduledEndTime > currentTime) {
    return false;
  }

  await endStudentSession({
    studentDocId: student.id,
    timeLogId,
    signOutAt: scheduledEndTime,
    signOutNotes: 'Automatically signed out after midnight at the scheduled event end time.',
  });

  return true;
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

export const listAnalyticsTimeLogsByRange = async ({ startDate, endDate }) => {
  const start = toDate(startDate);
  const end = toDate(endDate);

  if (!start || !end) {
    throw new Error('A valid start and end date are required to load analytics.');
  }

  const timeLogsCollection = collection(db, timeLogConfig.collectionName);
  const timeLogsById = new Map();
  const signInTimeLogsQuery = query(
    timeLogsCollection,
    where(timeLogConfig.signInAtField, '>=', Timestamp.fromDate(start)),
    where(timeLogConfig.signInAtField, '<=', Timestamp.fromDate(end)),
    orderBy(timeLogConfig.signInAtField, 'asc'),
  );
  const createdTimeLogsQuery = query(
    timeLogsCollection,
    where(timeLogConfig.createdAtField, '>=', Timestamp.fromDate(start)),
    where(timeLogConfig.createdAtField, '<=', Timestamp.fromDate(end)),
    orderBy(timeLogConfig.createdAtField, 'asc'),
  );
  // Normal sessions are found by sign-in time. Manually granted extra hours
  // have no sign-in timestamp, so they are also loaded by creation time.
  const snapshots = await Promise.all([
    getDocs(signInTimeLogsQuery),
    getDocs(createdTimeLogsQuery),
  ]);

  // A regular log has both timestamps and can appear in both queries.
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((timeLogDoc) => {
      timeLogsById.set(timeLogDoc.id, {
        id: timeLogDoc.id,
        ...timeLogDoc.data(),
      });
    });
  });

  return [...timeLogsById.values()].sort((left, right) => {
    const leftDate = toDate(left[timeLogConfig.signInAtField]) ?? toDate(left[timeLogConfig.createdAtField]);
    const rightDate = toDate(right[timeLogConfig.signInAtField]) ?? toDate(right[timeLogConfig.createdAtField]);

    return (leftDate?.getTime() ?? 0) - (rightDate?.getTime() ?? 0);
  });
};

export const watchCompletedTimeLogs = (callback, onError) => {
  const completedLogsQuery = query(
    collection(db, timeLogConfig.collectionName),
    where(timeLogConfig.statusField, '==', timeLogConfig.completedStatus),
  );

  return onSnapshot(
    completedLogsQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((timeLogDoc) => ({
          id: timeLogDoc.id,
          ...timeLogDoc.data(),
        })),
      );
    },
    onError,
  );
};
