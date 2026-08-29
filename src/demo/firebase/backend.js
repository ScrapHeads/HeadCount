import {
  extraTimeRequestConfig,
  kioskAuthConfig,
  scheduleConfig,
  studentAuthConfig,
  taskConfig,
  timeLogConfig,
} from '../../config/appConfig';
import { DEMO_CREDENTIALS, DEMO_STATE_STORAGE_KEY } from '../../config/demoMode';
import { MINUTES_PER_HOUR } from '../../lib/constants';

const DEFAULT_APP_NAME = '[DEFAULT]';
const DEMO_STATE_VERSION = 3;
const SERVER_TIMESTAMP_SENTINEL = Object.freeze({ __demoServerTimestamp: true });
const ARRAY_UNION_SENTINEL = Symbol('demoArrayUnion');

let stateCache = null;
let memoryState = null;

const apps = [];
const authInstances = new Map();
const authListeners = new Map();
const firestoreListeners = new Map();
let firestoreListenerId = 0;

export class DemoTimestamp {
  constructor(milliseconds) {
    this.milliseconds = Number(milliseconds);
    this.seconds = Math.floor(this.milliseconds / 1000);
    this.nanoseconds = Math.floor((this.milliseconds % 1000) * 1_000_000);
  }

  static now() {
    return new DemoTimestamp(Date.now());
  }

  static fromDate(date) {
    return new DemoTimestamp(date.getTime());
  }

  toDate() {
    return new Date(this.milliseconds);
  }

  toMillis() {
    return this.milliseconds;
  }

  valueOf() {
    return this.milliseconds;
  }
}

const isPlainObject = (value) => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && !(value instanceof Date)
  && !(value instanceof DemoTimestamp)
);

const makeTimestamp = (date) => DemoTimestamp.fromDate(date);

const cloneValue = (value) => {
  if (value instanceof DemoTimestamp) {
    return new DemoTimestamp(value.toMillis());
  }

  if (value instanceof Date) {
    return new Date(value);
  }

  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [key, cloneValue(childValue)]),
    );
  }

  return value;
};

const serializeValue = (value) => {
  if (value instanceof DemoTimestamp) {
    return { __demoTimestamp: value.toMillis() };
  }

  if (value instanceof Date) {
    return { __demoTimestamp: value.getTime() };
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [key, serializeValue(childValue)]),
    );
  }

  return value;
};

const deserializeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(deserializeValue);
  }

  if (isPlainObject(value)) {
    if (Object.prototype.hasOwnProperty.call(value, '__demoTimestamp')) {
      return new DemoTimestamp(value.__demoTimestamp);
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [key, deserializeValue(childValue)]),
    );
  }

  return value;
};

const createDemoUser = ({ email, password, uid }) => ({
  email,
  password,
  uid,
});

const buildStudentAuthEmail = (studentId) => (
  `${String(studentId).trim().toLowerCase()}@${studentAuthConfig.authEmailDomain}`
);

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const addDays = (date, days) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60_000);

const toLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getDemoFixtureDates = (now = new Date()) => {
  const today = startOfDay(now);

  return {
    activeScheduleEnd: addMinutes(now, 120),
    activeScheduleStart: addMinutes(now, -60),
    activeStartedAt: addMinutes(now, -48),
    lastWeek: addDays(today, -7),
    seedDate: toLocalDateKey(today),
    threeWeeksAgo: addDays(today, -21),
    today,
    twoWeeksAgo: addDays(today, -14),
  };
};

const createInitialState = () => {
  const {
    activeScheduleEnd,
    activeScheduleStart,
    activeStartedAt,
    lastWeek,
    seedDate,
    threeWeeksAgo,
    today,
    twoWeeksAgo,
  } = getDemoFixtureDates();
  const kioskEmail = kioskAuthConfig.email || DEMO_CREDENTIALS.kioskEmail;
  const demoStudents = [
    { docId: 'student-ada', id: '1001', name: 'Ada Lovelace', nfcCardId: 'nfc-ada' },
    { docId: 'student-grace', id: '1002', name: 'Grace Hopper', nfcCardId: 'nfc-grace' },
    { docId: 'student-katherine', id: '1003', name: 'Katherine Johnson', nfcCardId: 'nfc-katherine' },
    { docId: 'student-miguel', id: '1004', name: 'Miguel Santos', nfcCardId: 'nfc-miguel' },
  ];

  return {
    version: DEMO_STATE_VERSION,
    seedDate,
    auth: {
      currentUsersByApp: {},
      users: {
        'user-coach': createDemoUser({
          email: DEMO_CREDENTIALS.coachEmail,
          password: DEMO_CREDENTIALS.password,
          uid: 'user-coach',
        }),
        'user-kiosk': createDemoUser({
          email: kioskEmail,
          password: DEMO_CREDENTIALS.password,
          uid: 'user-kiosk',
        }),
        ...Object.fromEntries(demoStudents.map((student) => [
          `user-${student.docId}`,
          createDemoUser({
            email: buildStudentAuthEmail(student.id),
            password: DEMO_CREDENTIALS.password,
            uid: `user-${student.docId}`,
          }),
        ])),
      },
    },
    idCounters: {
      [studentAuthConfig.collectionName]: 5,
      [taskConfig.collectionName]: 6,
      [scheduleConfig.collectionName]: 3,
      [timeLogConfig.collectionName]: 8,
      [extraTimeRequestConfig.collectionName]: 4,
    },
    collections: {
      [studentAuthConfig.collectionName]: {
        'student-ada': {
          [studentAuthConfig.activeTimeLogIdField]: null,
          createdAt: makeTimestamp(addDays(today, -120)),
          [studentAuthConfig.currentMemberField]: true,
          [studentAuthConfig.currentTaskField]: null,
          [studentAuthConfig.currentTaskIdField]: null,
          [studentAuthConfig.idField]: '1001',
          [studentAuthConfig.nfcCardIdField]: 'nfc-ada',
          [studentAuthConfig.previousStudentIdField]: [],
          [studentAuthConfig.signedInAtField]: null,
          [studentAuthConfig.signedInField]: false,
          updatedAt: makeTimestamp(addDays(today, -120)),
          name: 'Ada Lovelace',
        },
        'student-grace': {
          [studentAuthConfig.activeTimeLogIdField]: 'time-log-active-grace',
          createdAt: makeTimestamp(addDays(today, -110)),
          [studentAuthConfig.currentMemberField]: true,
          [studentAuthConfig.currentTaskField]: 'Drive Practice',
          [studentAuthConfig.currentTaskIdField]: 'task-drive-practice',
          [studentAuthConfig.idField]: '1002',
          [studentAuthConfig.nfcCardIdField]: 'nfc-grace',
          [studentAuthConfig.previousStudentIdField]: ['902'],
          [studentAuthConfig.signedInAtField]: makeTimestamp(activeStartedAt),
          [studentAuthConfig.signedInField]: true,
          updatedAt: makeTimestamp(addDays(today, -110)),
          name: 'Grace Hopper',
        },
        'student-katherine': {
          [studentAuthConfig.activeTimeLogIdField]: null,
          createdAt: makeTimestamp(addDays(today, -100)),
          [studentAuthConfig.currentMemberField]: true,
          [studentAuthConfig.currentTaskField]: null,
          [studentAuthConfig.currentTaskIdField]: null,
          [studentAuthConfig.idField]: '1003',
          [studentAuthConfig.nfcCardIdField]: 'nfc-katherine',
          [studentAuthConfig.previousStudentIdField]: [],
          [studentAuthConfig.signedInAtField]: null,
          [studentAuthConfig.signedInField]: false,
          updatedAt: makeTimestamp(addDays(today, -100)),
          name: 'Katherine Johnson',
        },
        'student-miguel': {
          [studentAuthConfig.activeTimeLogIdField]: null,
          createdAt: makeTimestamp(addDays(today, -180)),
          [studentAuthConfig.currentMemberField]: false,
          [studentAuthConfig.currentTaskField]: null,
          [studentAuthConfig.currentTaskIdField]: null,
          [studentAuthConfig.idField]: '1004',
          [studentAuthConfig.nfcCardIdField]: 'nfc-miguel',
          [studentAuthConfig.previousStudentIdField]: [],
          [studentAuthConfig.signedInAtField]: null,
          [studentAuthConfig.signedInField]: false,
          updatedAt: makeTimestamp(addDays(today, -45)),
          name: 'Miguel Santos',
        },
      },
      [taskConfig.collectionName]: {
        'task-build': {
          [taskConfig.nameField]: 'Build',
          [taskConfig.scheduledField]: true,
        },
        'task-cad': {
          [taskConfig.nameField]: 'CAD',
          [taskConfig.scheduledField]: false,
        },
        'task-programming': {
          [taskConfig.nameField]: 'Programming',
          [taskConfig.scheduledField]: false,
        },
        'task-drive-practice': {
          [taskConfig.nameField]: 'Drive Practice',
          [taskConfig.scheduledField]: true,
        },
        'task-outreach': {
          [taskConfig.nameField]: 'Outreach',
          [taskConfig.scheduledField]: false,
        },
      },
      [scheduleConfig.collectionName]: {
        'schedule-drive-now': {
          [scheduleConfig.countsForAttendanceField]: true,
          [scheduleConfig.countsForOutreachField]: false,
          [scheduleConfig.dayOfMonthField]: null,
          [scheduleConfig.dayOfWeekField]: null,
          [scheduleConfig.endTimeField]: makeTimestamp(activeScheduleEnd),
          [scheduleConfig.excludedDatesField]: [],
          [scheduleConfig.isRecurringField]: false,
          [scheduleConfig.monthOfYearField]: null,
          [scheduleConfig.noteRequirementField]: scheduleConfig.noteRequirements.both,
          [scheduleConfig.recurrenceEndsBeforeField]: null,
          [scheduleConfig.recurrenceStartsOnField]: null,
          [scheduleConfig.recurrenceTypeField]: scheduleConfig.recurrenceTypes.oneTime,
          [scheduleConfig.startTimeField]: makeTimestamp(activeScheduleStart),
          [scheduleConfig.taskIdField]: 'task-drive-practice',
        },
        'schedule-weekly-build': {
          [scheduleConfig.countsForAttendanceField]: true,
          [scheduleConfig.countsForOutreachField]: false,
          [scheduleConfig.dayOfMonthField]: null,
          [scheduleConfig.dayOfWeekField]: lastWeek.getDay(),
          [scheduleConfig.endTimeField]: makeTimestamp(new Date(2000, 0, 2, 20, 0)),
          [scheduleConfig.excludedDatesField]: [],
          [scheduleConfig.isRecurringField]: true,
          [scheduleConfig.monthOfYearField]: null,
          [scheduleConfig.noteRequirementField]: scheduleConfig.noteRequirements.both,
          [scheduleConfig.recurrenceEndsBeforeField]: toLocalDateKey(addDays(today, 42)),
          [scheduleConfig.recurrenceStartsOnField]: toLocalDateKey(threeWeeksAgo),
          [scheduleConfig.recurrenceTypeField]: scheduleConfig.recurrenceTypes.weekly,
          [scheduleConfig.startTimeField]: makeTimestamp(new Date(2000, 0, 2, 18, 0)),
          [scheduleConfig.taskIdField]: 'task-build',
        },
      },
      [timeLogConfig.collectionName]: {
        'time-log-active-grace': {
          [timeLogConfig.createdAtField]: makeTimestamp(activeStartedAt),
          [timeLogConfig.durationMinutesField]: null,
          [timeLogConfig.signInAtField]: makeTimestamp(activeStartedAt),
          [timeLogConfig.signInNotesField]: 'Assemble intake side plates.',
          [timeLogConfig.signOutAtField]: null,
          [timeLogConfig.signOutNotesField]: null,
          [timeLogConfig.statusField]: timeLogConfig.activeStatus,
          [timeLogConfig.studentDocIdField]: 'student-grace',
          [timeLogConfig.studentIdField]: '1002',
          [timeLogConfig.studentNameField]: 'Grace Hopper',
          [timeLogConfig.taskIdField]: 'task-drive-practice',
          [timeLogConfig.taskNameField]: 'Drive Practice',
          [timeLogConfig.updatedAtField]: makeTimestamp(activeStartedAt),
        },
        'time-log-ada-cad': {
          [timeLogConfig.createdAtField]: makeTimestamp(addMinutes(lastWeek, 18 * 60)),
          [timeLogConfig.durationMinutesField]: 118,
          [timeLogConfig.signInAtField]: makeTimestamp(addMinutes(lastWeek, 18 * 60)),
          [timeLogConfig.signInNotesField]: 'Model gearbox plate revisions.',
          [timeLogConfig.signOutAtField]: makeTimestamp(addMinutes(lastWeek, 19 * 60 + 58)),
          [timeLogConfig.signOutNotesField]: 'Finished pocket layout.',
          [timeLogConfig.statusField]: timeLogConfig.completedStatus,
          [timeLogConfig.studentDocIdField]: 'student-ada',
          [timeLogConfig.studentIdField]: '1001',
          [timeLogConfig.studentNameField]: 'Ada Lovelace',
          [timeLogConfig.taskIdField]: 'task-cad',
          [timeLogConfig.taskNameField]: 'CAD',
          [timeLogConfig.updatedAtField]: makeTimestamp(addMinutes(lastWeek, 19 * 60 + 58)),
        },
        'time-log-grace-programming': {
          [timeLogConfig.createdAtField]: makeTimestamp(addMinutes(twoWeeksAgo, 17 * 60 + 30)),
          [timeLogConfig.durationMinutesField]: 95,
          [timeLogConfig.signInAtField]: makeTimestamp(addMinutes(twoWeeksAgo, 17 * 60 + 30)),
          [timeLogConfig.signInNotesField]: 'Tune autonomous path.',
          [timeLogConfig.signOutAtField]: makeTimestamp(addMinutes(twoWeeksAgo, 19 * 60 + 5)),
          [timeLogConfig.signOutNotesField]: 'Validated three-ball routine.',
          [timeLogConfig.statusField]: timeLogConfig.completedStatus,
          [timeLogConfig.studentDocIdField]: 'student-grace',
          [timeLogConfig.studentIdField]: '1002',
          [timeLogConfig.studentNameField]: 'Grace Hopper',
          [timeLogConfig.taskIdField]: 'task-programming',
          [timeLogConfig.taskNameField]: 'Programming',
          [timeLogConfig.updatedAtField]: makeTimestamp(addMinutes(twoWeeksAgo, 19 * 60 + 5)),
        },
        'time-log-katherine-build': {
          [timeLogConfig.createdAtField]: makeTimestamp(addMinutes(threeWeeksAgo, 18 * 60)),
          [timeLogConfig.durationMinutesField]: 122,
          [timeLogConfig.signInAtField]: makeTimestamp(addMinutes(threeWeeksAgo, 18 * 60)),
          [timeLogConfig.signInNotesField]: 'Inventory and prep belly pan hardware.',
          [timeLogConfig.signOutAtField]: makeTimestamp(addMinutes(threeWeeksAgo, 20 * 60 + 2)),
          [timeLogConfig.signOutNotesField]: 'Hardware bins labeled.',
          [timeLogConfig.statusField]: timeLogConfig.completedStatus,
          [timeLogConfig.studentDocIdField]: 'student-katherine',
          [timeLogConfig.studentIdField]: '1003',
          [timeLogConfig.studentNameField]: 'Katherine Johnson',
          [timeLogConfig.taskIdField]: 'task-build',
          [timeLogConfig.taskNameField]: 'Build',
          [timeLogConfig.updatedAtField]: makeTimestamp(addMinutes(threeWeeksAgo, 20 * 60 + 2)),
        },
        'time-log-ada-extra': {
          [timeLogConfig.createdAtField]: makeTimestamp(addDays(today, -3)),
          [timeLogConfig.durationMinutesField]: 90,
          [timeLogConfig.enteredByField]: DEMO_CREDENTIALS.coachEmail,
          [timeLogConfig.reasonField]: 'Off-site sponsor demo prep.',
          [timeLogConfig.statusField]: timeLogConfig.completedStatus,
          [timeLogConfig.studentDocIdField]: 'student-ada',
          [timeLogConfig.studentIdField]: '1001',
          [timeLogConfig.studentNameField]: 'Ada Lovelace',
          [timeLogConfig.taskNameField]: timeLogConfig.extraTimeTaskName,
          [timeLogConfig.updatedAtField]: makeTimestamp(addDays(today, -3)),
        },
        'time-log-grace-approved-extra': {
          [timeLogConfig.createdAtField]: makeTimestamp(addDays(today, -8)),
          [timeLogConfig.durationMinutesField]: 75,
          [timeLogConfig.enteredByField]: DEMO_CREDENTIALS.coachEmail,
          [timeLogConfig.reasonField]: 'Driver practice setup.',
          [timeLogConfig.statusField]: timeLogConfig.completedStatus,
          [timeLogConfig.studentDocIdField]: 'student-grace',
          [timeLogConfig.studentIdField]: '1002',
          [timeLogConfig.studentNameField]: 'Grace Hopper',
          [timeLogConfig.taskNameField]: timeLogConfig.extraTimeTaskName,
          [timeLogConfig.updatedAtField]: makeTimestamp(addDays(today, -8)),
        },
      },
      [extraTimeRequestConfig.collectionName]: {
        'request-ada-pending': {
          [extraTimeRequestConfig.durationMinutesField]: 60,
          [extraTimeRequestConfig.reasonField]: 'Finished scouting spreadsheet after the meeting.',
          [extraTimeRequestConfig.requestedAtField]: makeTimestamp(addDays(today, -1)),
          [extraTimeRequestConfig.reviewedAtField]: null,
          [extraTimeRequestConfig.reviewedByField]: null,
          [extraTimeRequestConfig.statusField]: extraTimeRequestConfig.pendingStatus,
          [extraTimeRequestConfig.studentDocIdField]: 'student-ada',
          [extraTimeRequestConfig.studentIdField]: '1001',
          [extraTimeRequestConfig.studentNameField]: 'Ada Lovelace',
        },
        'request-grace-approved': {
          [extraTimeRequestConfig.durationMinutesField]: 75,
          [extraTimeRequestConfig.reasonField]: 'Driver practice setup.',
          [extraTimeRequestConfig.requestedAtField]: makeTimestamp(addDays(today, -9)),
          [extraTimeRequestConfig.reviewedAtField]: makeTimestamp(addDays(today, -8)),
          [extraTimeRequestConfig.reviewedByField]: DEMO_CREDENTIALS.coachEmail,
          [extraTimeRequestConfig.statusField]: extraTimeRequestConfig.approvedStatus,
          [extraTimeRequestConfig.studentDocIdField]: 'student-grace',
          [extraTimeRequestConfig.studentIdField]: '1002',
          [extraTimeRequestConfig.studentNameField]: 'Grace Hopper',
        },
      },
    },
  };
};

const refreshDemoFixtureDates = (state) => {
  const dates = getDemoFixtureDates();

  if (state.seedDate === dates.seedDate) {
    return false;
  }

  state.seedDate = dates.seedDate;
  const collections = state.collections ?? {};
  const students = collections[studentAuthConfig.collectionName] ?? {};
  const schedules = collections[scheduleConfig.collectionName] ?? {};
  const timeLogs = collections[timeLogConfig.collectionName] ?? {};
  const extraTimeRequests = collections[extraTimeRequestConfig.collectionName] ?? {};
  const activeStudent = students['student-grace'];
  const activeLog = timeLogs['time-log-active-grace'];

  if (
    activeStudent?.[studentAuthConfig.signedInField]
    && activeStudent[studentAuthConfig.activeTimeLogIdField] === 'time-log-active-grace'
    && activeLog?.[timeLogConfig.statusField] === timeLogConfig.activeStatus
  ) {
    activeStudent[studentAuthConfig.signedInAtField] = makeTimestamp(dates.activeStartedAt);
    activeLog[timeLogConfig.createdAtField] = makeTimestamp(dates.activeStartedAt);
    activeLog[timeLogConfig.signInAtField] = makeTimestamp(dates.activeStartedAt);
    activeLog[timeLogConfig.updatedAtField] = makeTimestamp(dates.activeStartedAt);
  }

  const activeSchedule = schedules['schedule-drive-now'];
  if (activeSchedule) {
    activeSchedule[scheduleConfig.startTimeField] = makeTimestamp(dates.activeScheduleStart);
    activeSchedule[scheduleConfig.endTimeField] = makeTimestamp(dates.activeScheduleEnd);
  }

  const weeklyBuildSchedule = schedules['schedule-weekly-build'];
  if (weeklyBuildSchedule) {
    weeklyBuildSchedule[scheduleConfig.dayOfWeekField] = dates.today.getDay();
    weeklyBuildSchedule[scheduleConfig.recurrenceStartsOnField] = toLocalDateKey(
      dates.threeWeeksAgo,
    );
    weeklyBuildSchedule[scheduleConfig.recurrenceEndsBeforeField] = toLocalDateKey(
      addDays(dates.today, 42),
    );
  }

  const completedLogDates = [
    {
      end: addMinutes(dates.lastWeek, 19 * 60 + 58),
      id: 'time-log-ada-cad',
      start: addMinutes(dates.lastWeek, 18 * 60),
    },
    {
      end: addMinutes(dates.twoWeeksAgo, 19 * 60 + 5),
      id: 'time-log-grace-programming',
      start: addMinutes(dates.twoWeeksAgo, 17 * 60 + 30),
    },
    {
      end: addMinutes(dates.threeWeeksAgo, 20 * 60 + 2),
      id: 'time-log-katherine-build',
      start: addMinutes(dates.threeWeeksAgo, 18 * 60),
    },
  ];

  completedLogDates.forEach(({ end, id, start }) => {
    const timeLog = timeLogs[id];

    if (!timeLog) {
      return;
    }

    timeLog[timeLogConfig.createdAtField] = makeTimestamp(start);
    timeLog[timeLogConfig.signInAtField] = makeTimestamp(start);
    timeLog[timeLogConfig.signOutAtField] = makeTimestamp(end);
    timeLog[timeLogConfig.updatedAtField] = makeTimestamp(end);
  });

  const extraHoursLog = timeLogs['time-log-ada-extra'];
  if (extraHoursLog) {
    const extraHoursDate = addDays(dates.today, -3);
    extraHoursLog[timeLogConfig.createdAtField] = makeTimestamp(extraHoursDate);
    extraHoursLog[timeLogConfig.updatedAtField] = makeTimestamp(extraHoursDate);
  }

  const approvedExtraHoursLog = timeLogs['time-log-grace-approved-extra'];
  if (approvedExtraHoursLog) {
    const approvedExtraHoursDate = addDays(dates.today, -8);
    approvedExtraHoursLog[timeLogConfig.createdAtField] = makeTimestamp(
      approvedExtraHoursDate,
    );
    approvedExtraHoursLog[timeLogConfig.updatedAtField] = makeTimestamp(
      approvedExtraHoursDate,
    );
  }

  const pendingRequest = extraTimeRequests['request-ada-pending'];
  if (pendingRequest) {
    pendingRequest[extraTimeRequestConfig.requestedAtField] = makeTimestamp(
      addDays(dates.today, -1),
    );
  }

  const approvedRequest = extraTimeRequests['request-grace-approved'];
  if (approvedRequest) {
    approvedRequest[extraTimeRequestConfig.requestedAtField] = makeTimestamp(
      addDays(dates.today, -9),
    );
    approvedRequest[extraTimeRequestConfig.reviewedAtField] = makeTimestamp(
      addDays(dates.today, -8),
    );
  }

  return true;
};

const readStoredState = () => {
  if (typeof window === 'undefined') {
    memoryState ??= createInitialState();
    return memoryState;
  }

  const rawState = window.localStorage.getItem(DEMO_STATE_STORAGE_KEY);

  if (!rawState) {
    const initialState = createInitialState();
    window.localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(serializeValue(initialState)));
    return initialState;
  }

  try {
    const storedState = deserializeValue(JSON.parse(rawState));
    if (storedState?.version === DEMO_STATE_VERSION) {
      return storedState;
    }

    const initialState = createInitialState();
    window.localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(serializeValue(initialState)));
    return initialState;
  } catch {
    const initialState = createInitialState();
    window.localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(serializeValue(initialState)));
    return initialState;
  }
};

const getState = () => {
  stateCache ??= readStoredState();

  if (refreshDemoFixtureDates(stateCache)) {
    if (typeof window === 'undefined') {
      memoryState = stateCache;
    } else {
      window.localStorage.setItem(
        DEMO_STATE_STORAGE_KEY,
        JSON.stringify(serializeValue(stateCache)),
      );
    }
  }

  return stateCache;
};

const saveState = (state) => {
  stateCache = state;

  if (typeof window === 'undefined') {
    memoryState = state;
    return;
  }

  window.localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(serializeValue(state)));
};

const ensureCollection = (state, collectionName) => {
  state.collections[collectionName] ??= {};
  return state.collections[collectionName];
};

const nextDocumentId = (state, collectionName) => {
  const nextValue = state.idCounters[collectionName] ?? 1;
  state.idCounters[collectionName] = nextValue + 1;
  return `${collectionName}-${nextValue}`;
};

const writeValuesEqual = (left, right) => {
  if (left instanceof DemoTimestamp && right instanceof DemoTimestamp) {
    return left.toMillis() === right.toMillis();
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((item, index) => writeValuesEqual(item, right[index]));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftEntries = Object.entries(left);
    const rightKeys = Object.keys(right);

    return leftEntries.length === rightKeys.length
      && leftEntries.every(([key, childValue]) => (
        Object.prototype.hasOwnProperty.call(right, key)
        && writeValuesEqual(childValue, right[key])
      ));
  }

  return Object.is(left, right);
};

const resolveWriteValue = (value, currentValue) => {
  if (value === SERVER_TIMESTAMP_SENTINEL) {
    return DemoTimestamp.now();
  }

  if (
    isPlainObject(value)
    && Object.prototype.hasOwnProperty.call(value, ARRAY_UNION_SENTINEL)
  ) {
    const result = Array.isArray(currentValue)
      ? currentValue.map(cloneValue)
      : [];

    value[ARRAY_UNION_SENTINEL].forEach((item) => {
      const resolvedItem = resolveWriteValue(item);

      if (!result.some((existingItem) => writeValuesEqual(existingItem, resolvedItem))) {
        result.push(resolvedItem);
      }
    });

    return result;
  }

  if (value instanceof Date) {
    return DemoTimestamp.fromDate(value);
  }

  if (Array.isArray(value)) {
    return value.map(resolveWriteValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [
        key,
        resolveWriteValue(childValue, currentValue?.[key]),
      ]),
    );
  }

  return cloneValue(value);
};

const normalizeComparable = (value) => {
  if (value instanceof DemoTimestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return value;
};

const valuesEqual = (left, right) => (
  normalizeComparable(left) === normalizeComparable(right)
);

const compareValues = (left, right) => {
  const normalizedLeft = normalizeComparable(left);
  const normalizedRight = normalizeComparable(right);

  if (normalizedLeft === normalizedRight) {
    return 0;
  }

  if (normalizedLeft === undefined || normalizedLeft === null) {
    return 1;
  }

  if (normalizedRight === undefined || normalizedRight === null) {
    return -1;
  }

  return normalizedLeft > normalizedRight ? 1 : -1;
};

const getFieldValue = (data, fieldName) => data?.[fieldName];

const matchesWhereConstraint = (data, constraint) => {
  const fieldValue = getFieldValue(data, constraint.field);

  switch (constraint.operator) {
    case '==':
      return valuesEqual(fieldValue, constraint.value);
    case 'array-contains':
      return Array.isArray(fieldValue)
        && fieldValue.some((item) => valuesEqual(item, constraint.value));
    case '>=':
      return compareValues(fieldValue, constraint.value) >= 0;
    case '<=':
      return compareValues(fieldValue, constraint.value) <= 0;
    default:
      throw new Error(`Demo Firestore does not support "${constraint.operator}" queries.`);
  }
};

const getQueryDocuments = (target) => {
  const state = getState();
  const source = target.__demoType === 'query'
    ? target
    : { collectionName: target.collectionName, constraints: [] };
  const collectionData = state.collections[source.collectionName] ?? {};
  let documents = Object.entries(collectionData).map(([id, data]) => ({
    id,
    data,
  }));

  source.constraints.forEach((constraint) => {
    if (constraint.type === 'where') {
      documents = documents.filter(({ data }) => matchesWhereConstraint(data, constraint));
      return;
    }

    if (constraint.type === 'orderBy') {
      documents = documents.sort((left, right) => {
        const result = compareValues(
          getFieldValue(left.data, constraint.field),
          getFieldValue(right.data, constraint.field),
        );

        return constraint.direction === 'desc' ? -result : result;
      });
      return;
    }

    if (constraint.type === 'limit') {
      documents = documents.slice(0, constraint.count);
    }
  });

  return documents;
};

class DemoDocumentSnapshot {
  constructor({ data = null, id, exists = true }) {
    this.id = id;
    this._data = data;
    this._exists = exists;
  }

  exists() {
    return this._exists;
  }

  data() {
    return this._exists ? cloneValue(this._data) : undefined;
  }
}

class DemoQuerySnapshot {
  constructor(documents) {
    this.docs = documents.map(({ data, id }) => new DemoDocumentSnapshot({ data, id }));
    this.empty = this.docs.length === 0;
    this.size = this.docs.length;
  }

  forEach(callback) {
    this.docs.forEach(callback);
  }
}

const emitSnapshot = (listener) => {
  try {
    listener.onData(new DemoQuerySnapshot(getQueryDocuments(listener.target)));
  } catch (error) {
    listener.onError?.(error);
  }
};

const notifyFirestoreListeners = () => {
  firestoreListeners.forEach(emitSnapshot);
};

const getAuthListeners = (authName) => {
  if (!authListeners.has(authName)) {
    authListeners.set(authName, new Set());
  }

  return authListeners.get(authName);
};

const userForUid = (uid) => {
  if (!uid) {
    return null;
  }

  const user = getState().auth.users[uid];
  return user ? { email: user.email, uid: user.uid } : null;
};

const notifyAuthListeners = (authName) => {
  const auth = authInstances.get(authName);
  const currentUser = userForUid(getState().auth.currentUsersByApp[authName]);

  if (auth) {
    auth.currentUser = currentUser;
  }

  getAuthListeners(authName).forEach((listener) => listener(currentUser));
};

const mutateState = (callback, { notify = true } = {}) => {
  const state = getState();
  const result = callback(state);
  saveState(state);

  if (notify) {
    notifyFirestoreListeners();
  }

  return result;
};

const applySet = (state, ref, data) => {
  const collectionData = ensureCollection(state, ref.collectionName);
  collectionData[ref.id] = resolveWriteValue(data);
};

const applyDelete = (state, ref) => {
  const collectionData = ensureCollection(state, ref.collectionName);
  delete collectionData[ref.id];
};

const applyUpdate = (state, ref, data) => {
  const collectionData = ensureCollection(state, ref.collectionName);

  if (!collectionData[ref.id]) {
    throw new Error(`Demo document "${ref.collectionName}/${ref.id}" was not found.`);
  }

  collectionData[ref.id] = {
    ...collectionData[ref.id],
    ...resolveWriteValue(data, collectionData[ref.id]),
  };
};

const findAuthUserByEmail = (state, email) => {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  return Object.values(state.auth.users)
    .find((user) => user.email.toLowerCase() === normalizedEmail) ?? null;
};

const updateStudentCredentials = async ({ password, studentDocId, studentId }) => {
  return mutateState((state) => {
    const students = ensureCollection(state, studentAuthConfig.collectionName);
    const student = students[studentDocId];

    if (!student) {
      throw new Error('The student record could not be found.');
    }

    const currentStudentId = String(student[studentAuthConfig.idField] ?? '').trim().toLowerCase();
    const requestedStudentId = String(studentId ?? currentStudentId).trim().toLowerCase();

    if (!requestedStudentId) {
      throw new Error('Student ID is required.');
    }

    const currentEmail = buildStudentAuthEmail(currentStudentId);
    const requestedEmail = buildStudentAuthEmail(requestedStudentId);
    const authUser = findAuthUserByEmail(state, currentEmail);

    if (!authUser) {
      throw new Error('The student Authentication account could not be found.');
    }

    if (requestedStudentId !== currentStudentId) {
      const conflictingStudent = Object.entries(students)
        .find(([candidateDocId, candidate]) => (
          candidateDocId !== studentDocId
          && String(candidate[studentAuthConfig.idField] ?? '').trim().toLowerCase() === requestedStudentId
        ));

      if (conflictingStudent) {
        throw new Error('A student record already exists for this student ID.');
      }

      const conflictingAuthUser = findAuthUserByEmail(state, requestedEmail);

      if (conflictingAuthUser && conflictingAuthUser.uid !== authUser.uid) {
        throw new Error('A Firebase Authentication account already exists for this student ID.');
      }

      authUser.email = requestedEmail;
      student[studentAuthConfig.idField] = requestedStudentId;
      student[studentAuthConfig.previousStudentIdField] = [
        ...new Set([
          ...(student[studentAuthConfig.previousStudentIdField] ?? []),
          currentStudentId,
        ].filter((value) => value && value !== requestedStudentId)),
      ];
    }

    if (password) {
      authUser.password = password;
    }

    return {
      authEmail: authUser.email,
      authUid: authUser.uid,
      studentId: requestedStudentId,
    };
  });
};

export const getDemoApps = () => apps;

export const initializeDemoApp = (config, appName = DEFAULT_APP_NAME) => {
  const existingApp = apps.find((app) => app.name === appName);

  if (existingApp) {
    return existingApp;
  }

  const app = {
    name: appName,
    options: config,
  };
  apps.push(app);
  return app;
};

export const getDemoApp = (appName = DEFAULT_APP_NAME) => {
  const app = apps.find((candidateApp) => candidateApp.name === appName);

  if (!app) {
    throw new Error(`Demo Firebase app "${appName}" has not been initialized.`);
  }

  return app;
};

export const getDemoAuth = (app = getDemoApp()) => {
  const authName = app.name ?? DEFAULT_APP_NAME;

  if (!authInstances.has(authName)) {
    authInstances.set(authName, {
      app,
      currentUser: userForUid(getState().auth.currentUsersByApp[authName]),
      name: authName,
    });
  }

  return authInstances.get(authName);
};

export const onDemoAuthStateChanged = (auth, callback) => {
  getAuthListeners(auth.name).add(callback);
  queueMicrotask(() => callback(userForUid(getState().auth.currentUsersByApp[auth.name])));

  return () => {
    getAuthListeners(auth.name).delete(callback);
  };
};

export const signInDemoUser = async (auth, email, password) => {
  const user = findAuthUserByEmail(getState(), email);

  if (!user || user.password !== password) {
    const error = new Error('Demo credentials are invalid.');
    error.code = 'auth/invalid-credential';
    throw error;
  }

  mutateState((state) => {
    state.auth.currentUsersByApp[auth.name] = user.uid;
  }, { notify: false });
  notifyAuthListeners(auth.name);

  return {
    user: { email: user.email, uid: user.uid },
  };
};

export const signOutDemoUser = async (auth) => {
  mutateState((state) => {
    delete state.auth.currentUsersByApp[auth.name];
  }, { notify: false });
  notifyAuthListeners(auth.name);
};

export const createDemoAuthUser = async (auth, email, password) => {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();

  if (findAuthUserByEmail(getState(), normalizedEmail)) {
    const error = new Error('A demo auth user already exists for this email.');
    error.code = 'auth/email-already-in-use';
    throw error;
  }

  const user = mutateState((state) => {
    const uid = `user-${state.idCounters.authUsers ?? 1}`;
    state.idCounters.authUsers = (state.idCounters.authUsers ?? 1) + 1;
    state.auth.users[uid] = {
      email: normalizedEmail,
      password,
      uid,
    };
    state.auth.currentUsersByApp[auth.name] = uid;
    return state.auth.users[uid];
  }, { notify: false });
  notifyAuthListeners(auth.name);

  return {
    user: { email: user.email, uid: user.uid },
  };
};

export const deleteDemoAuthUser = async (user) => {
  if (!user?.uid) {
    return;
  }

  mutateState((state) => {
    delete state.auth.users[user.uid];
    Object.entries(state.auth.currentUsersByApp).forEach(([appName, uid]) => {
      if (uid === user.uid) {
        delete state.auth.currentUsersByApp[appName];
      }
    });
  }, { notify: false });
  authInstances.forEach((auth) => notifyAuthListeners(auth.name));
};

export const getDemoFirestore = (app = getDemoApp()) => ({
  app,
  type: 'demo-firestore',
});

export const collectionRef = (_db, collectionName) => ({
  __demoType: 'collection',
  collectionName,
});

export const documentRef = (...args) => {
  if (args[0]?.__demoType === 'collection') {
    const collection = args[0];
    return {
      __demoType: 'doc',
      collectionName: collection.collectionName,
      id: args[1] ?? nextDocumentId(getState(), collection.collectionName),
    };
  }

  const [, collectionName, documentId] = args;

  return {
    __demoType: 'doc',
    collectionName,
    id: documentId ?? nextDocumentId(getState(), collectionName),
  };
};

export const whereConstraint = (field, operator, value) => ({
  field,
  operator,
  type: 'where',
  value,
});

export const orderByConstraint = (field, direction = 'asc') => ({
  direction,
  field,
  type: 'orderBy',
});

export const limitConstraint = (count) => ({
  count,
  type: 'limit',
});

export const queryRef = (source, ...constraints) => ({
  __demoType: 'query',
  collectionName: source.collectionName,
  constraints: [
    ...(source.constraints ?? []),
    ...constraints,
  ],
});

export const getDemoDocs = async (target) => (
  new DemoQuerySnapshot(getQueryDocuments(target))
);

export const getDemoDoc = async (ref) => {
  const collectionData = getState().collections[ref.collectionName] ?? {};
  const data = collectionData[ref.id];

  return new DemoDocumentSnapshot({
    data,
    exists: Boolean(data),
    id: ref.id,
  });
};

export const addDemoDoc = async (collection, data) => {
  return mutateState((state) => {
    const id = nextDocumentId(state, collection.collectionName);
    const ref = {
      __demoType: 'doc',
      collectionName: collection.collectionName,
      id,
    };

    applySet(state, ref, data);
    return ref;
  });
};

export const updateDemoDoc = async (ref, data) => {
  mutateState((state) => {
    applyUpdate(state, ref, data);
  });
};

export const deleteDemoDoc = async (ref) => {
  mutateState((state) => {
    applyDelete(state, ref);
  });
};

export const onDemoSnapshot = (target, onData, onError) => {
  const id = firestoreListenerId;
  firestoreListenerId += 1;
  const listener = {
    id,
    onData,
    onError,
    target,
  };

  firestoreListeners.set(id, listener);
  emitSnapshot(listener);

  return () => {
    firestoreListeners.delete(id);
  };
};

export const createDemoBatch = () => {
  const operations = [];

  return {
    set(ref, data) {
      operations.push({ data, ref, type: 'set' });
    },
    update(ref, data) {
      operations.push({ data, ref, type: 'update' });
    },
    delete(ref) {
      operations.push({ ref, type: 'delete' });
    },
    async commit() {
      mutateState((state) => {
        operations.forEach((operation) => {
          if (operation.type === 'set') {
            applySet(state, operation.ref, operation.data);
            return;
          }

          if (operation.type === 'delete') {
            applyDelete(state, operation.ref);
            return;
          }

          applyUpdate(state, operation.ref, operation.data);
        });
      });
    },
  };
};

export const runDemoTransaction = async (_db, transactionCallback) => {
  const operations = [];
  const transaction = {
    async get(ref) {
      return getDemoDoc(ref);
    },
    set(ref, data) {
      operations.push({ data, ref, type: 'set' });
    },
    update(ref, data) {
      operations.push({ data, ref, type: 'update' });
    },
  };

  const result = await transactionCallback(transaction);

  mutateState((state) => {
    operations.forEach((operation) => {
      if (operation.type === 'set') {
        applySet(state, operation.ref, operation.data);
        return;
      }

      applyUpdate(state, operation.ref, operation.data);
    });
  });

  return result;
};

export const getDemoFunctions = (app = getDemoApp(), region = 'us-central1') => ({
  app,
  region,
});

export const callDemoFunction = async (name, data) => {
  if (name === 'updateStudentCredentials') {
    return updateStudentCredentials(data);
  }

  const error = new Error(`Demo function "${name}" is not implemented.`);
  error.code = 'functions/not-found';
  throw error;
};

export const demoServerTimestamp = () => SERVER_TIMESTAMP_SENTINEL;

export const demoArrayUnion = (...elements) => Object.freeze({
  [ARRAY_UNION_SENTINEL]: elements,
});

export const createExtraHoursLogPayload = ({ enteredBy, requestData, studentData, timeLogDocRef }) => ({
  [timeLogConfig.createdAtField]: demoServerTimestamp(),
  [timeLogConfig.durationMinutesField]: requestData[extraTimeRequestConfig.durationMinutesField],
  [timeLogConfig.enteredByField]: String(enteredBy ?? '').trim() || 'Coach',
  [timeLogConfig.reasonField]: requestData[extraTimeRequestConfig.reasonField],
  [timeLogConfig.statusField]: timeLogConfig.completedStatus,
  [timeLogConfig.studentDocIdField]: requestData[extraTimeRequestConfig.studentDocIdField],
  [timeLogConfig.studentIdField]: studentData[studentAuthConfig.idField],
  [timeLogConfig.studentNameField]: studentData.name ?? 'Student',
  [timeLogConfig.taskNameField]: timeLogConfig.extraTimeTaskName,
  [timeLogConfig.updatedAtField]: demoServerTimestamp(),
  id: timeLogDocRef.id,
});

export const demoMinutesToHours = (minutes) => Number(minutes) / MINUTES_PER_HOUR;
