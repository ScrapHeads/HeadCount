import { DEFAULT_ANALYTICS_RANGE_DAYS } from './constants';

export const toDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isSameCalendarDay = (left, right) => {
  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
};

export const isValidMonthDay = (year, month, dayOfMonth) => {
  const candidateDate = new Date(year, month, dayOfMonth);

  return (
    candidateDate.getFullYear() === year
    && candidateDate.getMonth() === month
    && candidateDate.getDate() === dayOfMonth
  );
};

export const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const getDefaultDateRange = ({
  days = DEFAULT_ANALYTICS_RANGE_DAYS,
  endDate = new Date(),
} = {}) => {
  const rangeEndDate = new Date(endDate);
  const startDate = new Date(rangeEndDate);
  startDate.setDate(rangeEndDate.getDate() - (days - 1));

  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(rangeEndDate),
  };
};

const signedInFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const formatSignedInAt = (value, fallback = 'Not recorded') => {
  const parsedDate = toDate(value);

  return parsedDate ? signedInFormatter.format(parsedDate) : fallback;
};
