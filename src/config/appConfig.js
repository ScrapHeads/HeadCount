import sharedConfig from '../../functions/sharedConfig.json';

// This file gives the frontend readable names for Firestore collections and
// fields. Values shared with Cloud Functions live in sharedConfig.json so both
// sides continue to agree if a collection or login setting changes.
export const studentAuthConfig = {
  collectionName: sharedConfig.studentAuth.collectionName,
  idField: sharedConfig.studentAuth.idField,
  // Old IDs remain on the student profile so historical logs do not need to
  // be rewritten when a coach changes the current login ID.
  previousStudentIdField: sharedConfig.studentAuth.previousStudentIdField,
  nfcCardIdField: sharedConfig.studentAuth.nfcCardIdField,
  authEmailDomain: (
    import.meta.env.VITE_STUDENT_AUTH_EMAIL_DOMAIN
    || sharedConfig.studentAuth.authEmailDomain
  ),
  minPasswordLength: sharedConfig.studentAuth.minPasswordLength,
  signedInField: 'signedIn',
  currentTaskField: 'currentTask',
  // Store the task id separately so sessions survive task renames.
  currentTaskIdField: 'currentTaskId',
  // Points to the active timeLogs document while a student is signed in.
  activeTimeLogIdField: 'activeTimeLogId',
  // Convenience field for dashboards showing who is currently active.
  signedInAtField: 'signedInAt',
  // Coaches use this roster flag to show students who are current team members.
  currentMemberField: 'currentMember',
  // 'auto' tries the raw string first and then a numeric match when possible.
  idValueType: 'auto',
};

export const kioskAuthConfig = {
  email: import.meta.env.VITE_KIOSK_AUTH_EMAIL ?? '',
};

export const taskConfig = {
  collectionName: 'tasks',
  nameField: 'name',
  scheduledField: 'scheduled',
};

export const scheduleConfig = {
  collectionName: 'schedules',
  taskIdField: 'taskId',
  isRecurringField: 'isRecurring',
  recurrenceTypeField: 'recurrenceType',
  dayOfWeekField: 'dayOfWeek',
  dayOfMonthField: 'dayOfMonth',
  monthOfYearField: 'monthOfYear',
  startTimeField: 'startTime',
  endTimeField: 'endTime',
  countsForAttendanceField: 'countsForAttendance',
  recurrenceTypes: {
    oneTime: 'one-time',
    weekly: 'weekly',
    monthly: 'monthly',
    yearly: 'yearly',
  },
};

export const timeLogConfig = {
  collectionName: sharedConfig.timeLogs.collectionName,
  // Keep both ids and snapshot names so historical logs remain readable if
  // the source student or task document is renamed later.
  studentDocIdField: sharedConfig.sharedFields.studentDocIdField,
  studentIdField: sharedConfig.sharedFields.studentIdField,
  studentNameField: 'studentName',
  taskIdField: 'taskId',
  taskNameField: 'taskName',
  signInAtField: 'signInAt',
  signOutAtField: 'signOutAt',
  signInNotesField: 'signInNotes',
  signOutNotesField: 'signOutNotes',
  statusField: 'status',
  durationMinutesField: 'durationMinutes',
  createdAtField: 'createdAt',
  updatedAtField: sharedConfig.sharedFields.updatedAtField,
  reasonField: 'reason',
  enteredByField: 'enteredBy',
  extraTimeTaskName: 'Extra Hours',
  activeStatus: 'active',
  completedStatus: 'completed',
};

export const extraTimeRequestConfig = {
  collectionName: sharedConfig.extraTimeRequests.collectionName,
  studentDocIdField: sharedConfig.sharedFields.studentDocIdField,
  studentIdField: sharedConfig.sharedFields.studentIdField,
  studentNameField: 'studentName',
  durationMinutesField: 'durationMinutes',
  reasonField: 'reason',
  statusField: 'status',
  requestedAtField: 'requestedAt',
  reviewedAtField: 'reviewedAt',
  reviewedByField: 'reviewedBy',
  updatedAtField: sharedConfig.sharedFields.updatedAtField,
  pendingStatus: 'pending',
  approvedStatus: 'approved',
  deniedStatus: 'denied',
};
