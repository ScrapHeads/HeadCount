import { Timestamp, addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { scheduleConfig } from '../../config/appConfig';
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

export const createSchedule = async ({
  taskId,
  startTime,
  endTime,
  isRecurring = false,
  recurrenceType = scheduleConfig.recurrenceTypes.oneTime,
  dayOfWeek = null,
  dayOfMonth = null,
  monthOfYear = null,
  countsForAttendance = true,
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

  // The task-level flag lets the sign-in page distinguish tasks that are
  // always available from tasks controlled by a schedule.
  await markTaskAsScheduled(taskId);

  // For recurring schedules the dates act as templates: recurrence fields
  // choose the calendar day and these timestamps provide the time and length.
  return addDoc(collection(db, scheduleConfig.collectionName), {
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
  });
};
