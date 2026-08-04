import { scheduleConfig } from '../../config/appConfig';
import { isValidMonthDay, toDate } from '../../lib/dateUtils';
import {
  isScheduleDateWithinBounds,
  isScheduleOccurrenceExcluded,
} from './scheduleUtils';

const getScheduleWindowForTime = (schedule, value = new Date()) => {
  const now = toDate(value);
  const startTime = toDate(schedule[scheduleConfig.startTimeField]);
  const endTime = toDate(schedule[scheduleConfig.endTimeField]);
  const isRecurring = Boolean(schedule[scheduleConfig.isRecurringField]);
  const recurrenceType = schedule[scheduleConfig.recurrenceTypeField]
    ?? (isRecurring ? scheduleConfig.recurrenceTypes.weekly : scheduleConfig.recurrenceTypes.oneTime);

  if (!now || !startTime || !endTime) {
    return null;
  }

  if (!isRecurring) {
    return now >= startTime && now <= endTime
      ? { startTime, endTime }
      : null;
  }

  if (isScheduleOccurrenceExcluded(schedule, now)) {
    return null;
  }

  if (!isScheduleDateWithinBounds(schedule, now)) {
    return null;
  }

  if (
    recurrenceType === scheduleConfig.recurrenceTypes.weekly
    && Number(schedule[scheduleConfig.dayOfWeekField]) !== now.getDay()
  ) {
    return null;
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.monthly) {
    const dayOfMonth = Number(schedule[scheduleConfig.dayOfMonthField]);

    if (
      !isValidMonthDay(now.getFullYear(), now.getMonth(), dayOfMonth)
      || now.getDate() !== dayOfMonth
    ) {
      return null;
    }
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.yearly) {
    const dayOfMonth = Number(schedule[scheduleConfig.dayOfMonthField]);
    const monthOfYear = Number(schedule[scheduleConfig.monthOfYearField]);

    if (
      !isValidMonthDay(now.getFullYear(), monthOfYear, dayOfMonth)
      || now.getMonth() !== monthOfYear
      || now.getDate() !== dayOfMonth
    ) {
      return null;
    }
  }

  const durationMs = endTime.getTime() - startTime.getTime();

  if (durationMs <= 0) {
    return null;
  }

  // Reuse the stored time of day on the current recurrence date. Keeping the
  // duration also supports events that end after midnight.
  const occurrenceStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    startTime.getHours(),
    startTime.getMinutes(),
    startTime.getSeconds(),
    startTime.getMilliseconds(),
  );
  const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);

  return now >= occurrenceStart && now <= occurrenceEnd
    ? { startTime: occurrenceStart, endTime: occurrenceEnd }
    : null;
};

export const isScheduleActive = (schedule, now = new Date()) => (
  Boolean(getScheduleWindowForTime(schedule, now))
);

export const getScheduledTaskEndTime = ({ schedules = [], taskId, time }) => {
  const normalizedTaskId = String(taskId ?? '').trim();

  if (!normalizedTaskId) {
    return null;
  }

  const matchingEndTimes = schedules
    .filter((schedule) => (
      String(schedule?.[scheduleConfig.taskIdField] ?? '').trim() === normalizedTaskId
    ))
    .map((schedule) => getScheduleWindowForTime(schedule, time)?.endTime ?? null)
    .filter(Boolean)
    .sort((left, right) => left - right);

  // A task may have overlapping schedules; the earliest active end is the
  // safest automatic sign-out point.
  return matchingEndTimes[0] ?? null;
};
