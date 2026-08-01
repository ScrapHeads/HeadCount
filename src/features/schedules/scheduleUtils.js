import { scheduleConfig } from '../../config/appConfig';
import {
  isValidMonthDay,
  toDate,
  toDateInputValue,
} from '../../lib/dateUtils';

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
});

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
});

const getRecurrenceType = (schedule) => (
  schedule?.[scheduleConfig.recurrenceTypeField]
  ?? (
    schedule?.[scheduleConfig.isRecurringField]
      ? scheduleConfig.recurrenceTypes.weekly
      : scheduleConfig.recurrenceTypes.oneTime
  )
);

export const isOutreachSchedule = (schedule) => (
  schedule?.[scheduleConfig.countsForOutreachField] === true
);

export const isAttendanceSchedule = (schedule) => (
  !isOutreachSchedule(schedule)
  && schedule?.[scheduleConfig.countsForAttendanceField] !== false
);

const getExcludedDateKeys = (schedule) => {
  const excludedDates = schedule?.[scheduleConfig.excludedDatesField];

  return new Set(
    (Array.isArray(excludedDates) ? excludedDates : [])
      .map((value) => {
        if (typeof value === 'string') {
          return value;
        }

        const parsedDate = toDate(value);
        return parsedDate ? toDateInputValue(parsedDate) : '';
      })
      .filter(Boolean),
  );
};

export const isScheduleOccurrenceExcluded = (schedule, date) => {
  const parsedDate = toDate(date);

  if (!parsedDate) {
    return false;
  }

  return getExcludedDateKeys(schedule).has(toDateInputValue(parsedDate));
};

const recurringScheduleMatchesDate = (schedule, date) => {
  const recurrenceType = getRecurrenceType(schedule);

  if (recurrenceType === scheduleConfig.recurrenceTypes.weekly) {
    return Number(schedule[scheduleConfig.dayOfWeekField]) === date.getDay();
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.monthly) {
    const dayOfMonth = Number(schedule[scheduleConfig.dayOfMonthField]);

    return (
      isValidMonthDay(date.getFullYear(), date.getMonth(), dayOfMonth)
      && date.getDate() === dayOfMonth
    );
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.yearly) {
    const dayOfMonth = Number(schedule[scheduleConfig.dayOfMonthField]);
    const monthOfYear = Number(schedule[scheduleConfig.monthOfYearField]);

    return (
      isValidMonthDay(date.getFullYear(), monthOfYear, dayOfMonth)
      && date.getMonth() === monthOfYear
      && date.getDate() === dayOfMonth
    );
  }

  return false;
};

export const getScheduleOccurrenceForDate = (schedule, date) => {
  const occurrenceDate = toDate(date);
  const baseStart = toDate(schedule?.[scheduleConfig.startTimeField]);
  const baseEnd = toDate(schedule?.[scheduleConfig.endTimeField]);

  if (!occurrenceDate || !baseStart || !baseEnd || baseEnd <= baseStart) {
    return null;
  }

  const dateKey = toDateInputValue(occurrenceDate);
  const isRecurring = Boolean(schedule[scheduleConfig.isRecurringField]);

  if (!isRecurring) {
    const dayStart = new Date(
      occurrenceDate.getFullYear(),
      occurrenceDate.getMonth(),
      occurrenceDate.getDate(),
    );
    const nextDayStart = new Date(
      occurrenceDate.getFullYear(),
      occurrenceDate.getMonth(),
      occurrenceDate.getDate() + 1,
    );

    if (baseStart >= nextDayStart || baseEnd <= dayStart) {
      return null;
    }

    return {
      dateKey,
      endTime: baseEnd,
      isRecurring: false,
      schedule,
      startTime: baseStart,
    };
  }

  if (
    !recurringScheduleMatchesDate(schedule, occurrenceDate)
    || isScheduleOccurrenceExcluded(schedule, occurrenceDate)
  ) {
    return null;
  }

  const durationMs = baseEnd.getTime() - baseStart.getTime();
  const occurrenceStart = new Date(
    occurrenceDate.getFullYear(),
    occurrenceDate.getMonth(),
    occurrenceDate.getDate(),
    baseStart.getHours(),
    baseStart.getMinutes(),
    baseStart.getSeconds(),
    baseStart.getMilliseconds(),
  );

  return {
    dateKey,
    endTime: new Date(occurrenceStart.getTime() + durationMs),
    isRecurring: true,
    schedule,
    startTime: occurrenceStart,
  };
};

export const getScheduleOccurrencesInRange = (
  schedules,
  rangeStart,
  rangeEnd,
) => {
  const startDate = toDate(rangeStart);
  const endDate = toDate(rangeEnd);

  if (!startDate || !endDate || startDate > endDate) {
    return [];
  }

  const occurrences = [];
  const currentDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  );
  const finalDate = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
  );

  while (currentDate <= finalDate) {
    schedules.forEach((schedule) => {
      const occurrence = getScheduleOccurrenceForDate(schedule, currentDate);

      if (occurrence) {
        occurrences.push(occurrence);
      }
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return occurrences.sort((left, right) => (
    left.startTime - right.startTime
    || String(left.schedule.id ?? '').localeCompare(String(right.schedule.id ?? ''))
  ));
};

export const getScheduleRecurrenceLabel = (schedule) => {
  const recurrenceType = getRecurrenceType(schedule);

  if (recurrenceType === scheduleConfig.recurrenceTypes.oneTime) {
    return 'One-time meeting';
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.weekly) {
    const dayOfWeek = Number(schedule?.[scheduleConfig.dayOfWeekField]);
    const weekday = Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6
      ? weekdayFormatter.format(new Date(2024, 0, 7 + dayOfWeek))
      : '';

    return `Weekly${weekday ? ` on ${weekday}` : ''}`;
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.monthly) {
    return `Monthly on day ${schedule?.[scheduleConfig.dayOfMonthField] ?? ''}`.trim();
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.yearly) {
    const monthOfYear = Number(schedule?.[scheduleConfig.monthOfYearField]);
    const month = Number.isInteger(monthOfYear) && monthOfYear >= 0 && monthOfYear <= 11
      ? monthFormatter.format(new Date(2024, monthOfYear, 1))
      : '';
    const dayOfMonth = schedule?.[scheduleConfig.dayOfMonthField] ?? '';

    return `Yearly${month ? ` on ${month}` : ''}${dayOfMonth ? ` ${dayOfMonth}` : ''}`;
  }

  return 'Recurring meeting';
};
