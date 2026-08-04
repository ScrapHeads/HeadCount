import {
  Timestamp,
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { scheduleConfig } from '../../config/appConfig';
import {
  shiftDateInputValue,
  toDate,
  toDateInputValue,
} from '../../lib/dateUtils';
import { db } from '../../services/firebase';
import { markTaskAsScheduled } from '../tasks/taskService';

export const listSchedules = async () => {
  const scheduleSnapshot = await getDocs(collection(db, scheduleConfig.collectionName));

  return scheduleSnapshot.docs.map((scheduleDoc) => ({
    id: scheduleDoc.id,
    ...scheduleDoc.data(),
  }));
};

export const listSchedulesForTask = async (taskId) => {
  const scheduleQuery = query(
    collection(db, scheduleConfig.collectionName),
    where(scheduleConfig.taskIdField, '==', taskId),
  );
  const scheduleSnapshot = await getDocs(scheduleQuery);

  return scheduleSnapshot.docs.map((scheduleDoc) => ({
    id: scheduleDoc.id,
    ...scheduleDoc.data(),
  }));
};

const buildScheduleData = ({
  taskId,
  startTime,
  endTime,
  isRecurring = false,
  recurrenceType = scheduleConfig.recurrenceTypes.oneTime,
  dayOfWeek = null,
  dayOfMonth = null,
  monthOfYear = null,
  countsForAttendance = true,
  countsForOutreach = false,
  noteRequirement = scheduleConfig.noteRequirements.both,
  recurrenceStartsOn = null,
  recurrenceEndsOn = null,
}) => {
  if (!taskId) {
    throw new Error('A task is required to create a schedule.');
  }

  if (!(startTime instanceof Date) || Number.isNaN(startTime.getTime())) {
    throw new Error('A valid start date and time is required.');
  }

  if (!(endTime instanceof Date) || Number.isNaN(endTime.getTime())) {
    throw new Error('A valid end date and time is required.');
  }

  if (endTime <= startTime) {
    throw new Error('End date and time must be after the start date and time.');
  }

  if (isRecurring && recurrenceType === scheduleConfig.recurrenceTypes.weekly && (dayOfWeek === null || dayOfWeek === undefined || Number.isNaN(Number(dayOfWeek)))) {
    throw new Error('A day of week is required for a weekly recurring event.');
  }

  if (
    isRecurring
    && (recurrenceType === scheduleConfig.recurrenceTypes.monthly || recurrenceType === scheduleConfig.recurrenceTypes.yearly)
    && (dayOfMonth === null || dayOfMonth === undefined || Number.isNaN(Number(dayOfMonth)) || Number(dayOfMonth) < 1 || Number(dayOfMonth) > 31)
  ) {
    throw new Error('A valid day of month is required for monthly or yearly recurring events.');
  }

  if (
    isRecurring
    && recurrenceType === scheduleConfig.recurrenceTypes.yearly
    && (monthOfYear === null || monthOfYear === undefined || Number.isNaN(Number(monthOfYear)) || Number(monthOfYear) < 0 || Number(monthOfYear) > 11)
  ) {
    throw new Error('A valid month is required for a yearly recurring event.');
  }

  const recurrenceStartsOnKey = isRecurring
    ? getDateKey(recurrenceStartsOn)
    : null;
  const recurrenceEndsOnKey = isRecurring
    ? getDateKey(recurrenceEndsOn)
    : null;

  if (isRecurring && (!recurrenceStartsOnKey || !recurrenceEndsOnKey)) {
    throw new Error('A start and end date are required for a recurring event.');
  }

  if (isRecurring && recurrenceEndsOnKey < recurrenceStartsOnKey) {
    throw new Error('The recurring end date cannot be before the start date.');
  }

  return {
    [scheduleConfig.taskIdField]: taskId,
    [scheduleConfig.isRecurringField]: Boolean(isRecurring),
    [scheduleConfig.recurrenceTypeField]: isRecurring ? recurrenceType : scheduleConfig.recurrenceTypes.oneTime,
    [scheduleConfig.dayOfWeekField]: recurrenceType === scheduleConfig.recurrenceTypes.weekly ? Number(dayOfWeek) : null,
    [scheduleConfig.dayOfMonthField]: (
      recurrenceType === scheduleConfig.recurrenceTypes.monthly
      || recurrenceType === scheduleConfig.recurrenceTypes.yearly
    ) ? Number(dayOfMonth) : null,
    [scheduleConfig.monthOfYearField]: recurrenceType === scheduleConfig.recurrenceTypes.yearly ? Number(monthOfYear) : null,
    [scheduleConfig.startTimeField]: Timestamp.fromDate(startTime),
    [scheduleConfig.endTimeField]: Timestamp.fromDate(endTime),
    [scheduleConfig.countsForAttendanceField]: Boolean(countsForAttendance),
    [scheduleConfig.countsForOutreachField]: Boolean(countsForOutreach),
    [scheduleConfig.noteRequirementField]: noteRequirement,
    [scheduleConfig.recurrenceStartsOnField]: recurrenceStartsOnKey,
    [scheduleConfig.recurrenceEndsBeforeField]: isRecurring
      ? shiftDateInputValue(recurrenceEndsOnKey, 1)
      : null,
  };
};

const getDateKey = (value) => {
  const parsedDate = toDate(value);

  if (
    typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return shiftDateInputValue(value, 0);
  }

  return parsedDate ? toDateInputValue(parsedDate) : '';
};

export const createSchedule = async (scheduleDetails) => {
  const scheduleData = buildScheduleData(scheduleDetails);

  // The task-level flag lets the sign-in page distinguish tasks that are
  // always available from tasks controlled by a schedule.
  await markTaskAsScheduled(scheduleData[scheduleConfig.taskIdField]);

  // For recurring schedules the dates act as templates: recurrence fields
  // choose the calendar day and these timestamps provide the time and length.
  return addDoc(collection(db, scheduleConfig.collectionName), {
    ...scheduleData,
    [scheduleConfig.excludedDatesField]: [],
  });
};

export const updateSchedule = async ({
  occurrenceDate,
  schedule,
  updateScope = 'future',
  ...scheduleDetails
}) => {
  if (!schedule?.id) {
    throw new Error('A scheduled event is required.');
  }

  const scheduleData = buildScheduleData(scheduleDetails);
  const scheduleRef = doc(db, scheduleConfig.collectionName, schedule.id);
  const wasRecurring = Boolean(schedule[scheduleConfig.isRecurringField]);
  const occurrenceDateKey = getDateKey(occurrenceDate);

  if (!wasRecurring) {
    await markTaskAsScheduled(scheduleData[scheduleConfig.taskIdField]);
    return updateDoc(scheduleRef, {
      ...scheduleData,
      [scheduleConfig.excludedDatesField]: [],
    });
  }

  if (!occurrenceDateKey || !['occurrence', 'future'].includes(updateScope)) {
    throw new Error('Choose a valid recurring event and update option.');
  }

  if (updateScope === 'occurrence' && scheduleData[scheduleConfig.isRecurringField]) {
    throw new Error('A single occurrence must be saved as a one-time event.');
  }

  if (
    updateScope === 'future'
    && (
      (
        scheduleData[scheduleConfig.isRecurringField]
        && scheduleData[scheduleConfig.recurrenceStartsOnField] < occurrenceDateKey
      )
      || (
        !scheduleData[scheduleConfig.isRecurringField]
        && toDateInputValue(scheduleDetails.startTime) < occurrenceDateKey
      )
    )
  ) {
    throw new Error('A future update cannot start before the selected date.');
  }

  await markTaskAsScheduled(scheduleData[scheduleConfig.taskIdField]);

  const existingStartsOn = schedule[scheduleConfig.recurrenceStartsOnField] ?? null;
  if (updateScope === 'future' && existingStartsOn === occurrenceDateKey) {
    return updateDoc(scheduleRef, {
      ...scheduleData,
      [scheduleConfig.excludedDatesField]: schedule[scheduleConfig.excludedDatesField] ?? [],
    });
  }

  const batch = writeBatch(db);
  const replacementRef = doc(collection(db, scheduleConfig.collectionName));

  // A one-date change excludes the original occurrence. A future change ends
  // the old segment at the selected date and starts its replacement there.
  batch.update(scheduleRef, updateScope === 'occurrence'
    ? { [scheduleConfig.excludedDatesField]: arrayUnion(occurrenceDateKey) }
    : { [scheduleConfig.recurrenceEndsBeforeField]: occurrenceDateKey });
  batch.set(replacementRef, {
    ...scheduleData,
    [scheduleConfig.excludedDatesField]: updateScope === 'future'
      ? schedule[scheduleConfig.excludedDatesField] ?? []
      : [],
  });

  await batch.commit();
  return replacementRef;
};

export const excludeScheduleOccurrence = async ({
  scheduleId,
  occurrenceDate,
}) => {
  const occurrenceDateKey = getDateKey(occurrenceDate);

  if (!scheduleId || !occurrenceDateKey) {
    throw new Error('A valid scheduled occurrence is required.');
  }

  await updateDoc(doc(db, scheduleConfig.collectionName, scheduleId), {
    [scheduleConfig.excludedDatesField]: arrayUnion(occurrenceDateKey),
  });
};

export const deleteSchedule = async (scheduleId) => {
  if (!scheduleId) {
    throw new Error('A scheduled event is required.');
  }

  await deleteDoc(doc(db, scheduleConfig.collectionName, scheduleId));
};
