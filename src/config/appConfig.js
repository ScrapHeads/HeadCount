export const studentAuthConfig = {
  collectionName: 'students',
  idField: 'studentId',
  nfcCardIdField: 'nfcCardId',
  authEmailDomain: 'myapp.internal',
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
  collectionName: 'timeLogs',
  // Keep both ids and snapshot names so historical logs remain readable if
  // the source student or task document is renamed later.
  studentDocIdField: 'studentDocId',
  studentIdField: 'studentId',
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
  updatedAtField: 'updatedAt',
  reasonField: 'reason',
  enteredByField: 'enteredBy',
  extraTimeTaskName: 'Extra Hours',
  activeStatus: 'active',
  completedStatus: 'completed',
};

export const extraTimeRequestConfig = {
  collectionName: 'extraTimeRequests',
  studentDocIdField: 'studentDocId',
  studentIdField: 'studentId',
  studentNameField: 'studentName',
  durationMinutesField: 'durationMinutes',
  reasonField: 'reason',
  statusField: 'status',
  requestedAtField: 'requestedAt',
  reviewedAtField: 'reviewedAt',
  reviewedByField: 'reviewedBy',
  pendingStatus: 'pending',
  approvedStatus: 'approved',
  deniedStatus: 'denied',
};
