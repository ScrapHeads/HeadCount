export const studentAuthConfig = {
  collectionName: 'students',
  idField: 'studentId',
  passwordField: 'password',
  signedInField: 'signedIn',
  currentTaskField: 'currentTask',
  currentTaskIdField: 'currentTaskId',
  activeTimeLogIdField: 'activeTimeLogId',
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
  dayOfWeekField: 'dayOfWeek',
  startTimeField: 'startTime',
  endTimeField: 'endTime',
};

export const timeLogConfig = {
  collectionName: 'timeLogs',
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
