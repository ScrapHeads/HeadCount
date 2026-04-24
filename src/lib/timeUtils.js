import { isSameCalendarDay, toDate } from './dateUtils';

const buildComparableTime = (source, target) => {
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds(),
  );
};

export const isCurrentTimeWithinSchedule = ({ now, startTime, endTime, isRecurring }) => {
  const nowDate = toDate(now);
  const startDate = toDate(startTime);
  const endDate = toDate(endTime);

  if (!nowDate || !startDate || !endDate) {
    return false;
  }

  if (isRecurring) {
    const comparableStart = buildComparableTime(startDate, nowDate);
    const comparableEnd = buildComparableTime(endDate, nowDate);
    return nowDate >= comparableStart && nowDate <= comparableEnd;
  }

  return isSameCalendarDay(nowDate, startDate) && nowDate >= startDate && nowDate <= endDate;
};
