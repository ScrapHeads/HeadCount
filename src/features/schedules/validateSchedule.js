import { scheduleConfig } from '../../config/appConfig';
import { toDate } from '../../lib/dateUtils';
import { isCurrentTimeWithinSchedule } from '../../lib/timeUtils';

const isValidMonthDay = (year, month, dayOfMonth) => {
  const candidateDate = new Date(year, month, dayOfMonth);

  return (
    candidateDate.getFullYear() === year
    && candidateDate.getMonth() === month
    && candidateDate.getDate() === dayOfMonth
  );
};

export const isScheduleActive = (schedule, now = new Date()) => {
  const startTime = toDate(schedule[scheduleConfig.startTimeField]);
  const endTime = toDate(schedule[scheduleConfig.endTimeField]);
  const isRecurring = Boolean(schedule[scheduleConfig.isRecurringField]);
  const recurrenceType = schedule[scheduleConfig.recurrenceTypeField]
    ?? (isRecurring ? scheduleConfig.recurrenceTypes.weekly : scheduleConfig.recurrenceTypes.oneTime);

  if (!startTime || !endTime) {
    return false;
  }

  if (isRecurring) {
    if (recurrenceType === scheduleConfig.recurrenceTypes.weekly) {
      return (
        schedule[scheduleConfig.dayOfWeekField] === now.getDay()
        && isCurrentTimeWithinSchedule({ now, startTime, endTime, isRecurring: true })
      );
    }

    if (recurrenceType === scheduleConfig.recurrenceTypes.monthly) {
      const dayOfMonth = Number(schedule[scheduleConfig.dayOfMonthField]);

      return (
        isValidMonthDay(now.getFullYear(), now.getMonth(), dayOfMonth)
        && now.getDate() === dayOfMonth
        && isCurrentTimeWithinSchedule({ now, startTime, endTime, isRecurring: true })
      );
    }

    if (recurrenceType === scheduleConfig.recurrenceTypes.yearly) {
      const dayOfMonth = Number(schedule[scheduleConfig.dayOfMonthField]);
      const monthOfYear = Number(schedule[scheduleConfig.monthOfYearField]);

      return (
        isValidMonthDay(now.getFullYear(), monthOfYear, dayOfMonth)
        && now.getMonth() === monthOfYear
        && now.getDate() === dayOfMonth
        && isCurrentTimeWithinSchedule({ now, startTime, endTime, isRecurring: true })
      );
    }
  }

  return isCurrentTimeWithinSchedule({ now, startTime, endTime, isRecurring: false });
};
