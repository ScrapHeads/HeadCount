export const studentAuthConfig = {
  collectionName: 'students',
  idField: 'studentId',
  authEmailDomain: 'myapp.internal',
  signedInField: 'signedIn',
  currentTaskField: 'currentTask',
  // Store the task id separately so sessions survive task renames.
  currentTaskIdField: 'currentTaskId',
  // Points to the active timeLogs document while a student is signed in.
  activeTimeLogIdField: 'activeTimeLogId',
  // Convenience field for dashboards showing who is currently active.
  signedInAtField: 'signedInAt',
  // 'auto' tries the raw string first and then a numeric match when possible.
  idValueType: 'auto',
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
  activeStatus: 'active',
  completedStatus: 'completed',
};
