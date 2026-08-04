import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDateTime,
  getDefaultDateRange,
  isSameCalendarDay,
  isValidMonthDay,
  shiftDateInputValue,
  toDate,
  toDateInputValue,
} from '../../src/lib/dateUtils.js';

test('formatDateTime formats valid values and returns the requested fallback', () => {
  assert.match(formatDateTime(new Date(2026, 6, 9, 14, 30)), /Jul 9, 2026.*2:30 PM/);
  assert.equal(formatDateTime(null), '-');
  assert.equal(formatDateTime('not-a-date', 'Not scheduled'), 'Not scheduled');
});

test('toDate handles Date instances, Firestore-like timestamps, strings, and invalid values', () => {
  const date = new Date(2026, 6, 9, 14, 30);
  const timestampDate = new Date(2026, 6, 10, 9, 15);

  assert.equal(toDate(date), date);
  assert.deepEqual(toDate({ toDate: () => timestampDate }), timestampDate);
  assert.deepEqual(toDate('2026-07-11T12:00:00'), new Date('2026-07-11T12:00:00'));
  assert.equal(toDate('not-a-date'), null);
  assert.equal(toDate(null), null);
});

test('isSameCalendarDay compares local calendar dates', () => {
  assert.equal(
    isSameCalendarDay(
      new Date(2026, 6, 9, 0, 1),
      new Date(2026, 6, 9, 23, 59),
    ),
    true,
  );
  assert.equal(
    isSameCalendarDay(
      new Date(2026, 6, 9, 23, 59),
      new Date(2026, 6, 10, 0, 0),
    ),
    false,
  );
});

test('isValidMonthDay rejects impossible month/day combinations', () => {
  assert.equal(isValidMonthDay(2024, 1, 29), true);
  assert.equal(isValidMonthDay(2025, 1, 29), false);
  assert.equal(isValidMonthDay(2026, 3, 31), false);
});

test('toDateInputValue formats local dates for HTML date inputs', () => {
  assert.equal(toDateInputValue(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
  assert.equal(toDateInputValue(new Date(2026, 10, 15, 1, 30)), '2026-11-15');
});

test('shiftDateInputValue moves local date keys across month and year boundaries', () => {
  assert.equal(shiftDateInputValue('2026-08-31', 1), '2026-09-01');
  assert.equal(shiftDateInputValue('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDateInputValue('not-a-date', 1), '');
});

test('getDefaultDateRange returns an inclusive date range', () => {
  assert.deepEqual(
    getDefaultDateRange({
      days: 7,
      endDate: new Date(2026, 6, 9, 12),
    }),
    {
      startDate: '2026-07-03',
      endDate: '2026-07-09',
    },
  );
});
