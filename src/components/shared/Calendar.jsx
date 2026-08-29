import { useMemo, useState } from 'react';
import { scheduleConfig, taskConfig } from '../../config/appConfig';
import {
  getScheduleOccurrencesInRange,
  getScheduleRecurrenceLabel,
  isAttendanceSchedule,
  isOutreachSchedule,
} from '../../features/schedules/scheduleUtils';
import { toDate, toDateInputValue } from '../../lib/dateUtils';
import Dropdown from './Dropdown';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const monthHeadingFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

const weekHeadingFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const dayDetailFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

const occurrenceDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const meetingTypeOptions = [
  { label: 'All meetings', value: 'all' },
  { label: 'Attendance', value: 'attendance' },
  { label: 'Outreach', value: 'outreach' },
];

const startOfWeek = (value) => {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  date.setDate(date.getDate() - date.getDay());
  return date;
};

const addDays = (value, amount) => {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
};

const parseLocalDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
  ) ? date : null;
};

const scheduleMatchesMeetingType = (schedule, meetingType) => (
  meetingType === 'all'
  || (meetingType === 'attendance' && isAttendanceSchedule(schedule))
  || (meetingType === 'outreach' && isOutreachSchedule(schedule))
);

const getOccurrenceRange = (matchingSchedules) => {
  let rangeStart = null;
  let rangeEnd = null;

  matchingSchedules.forEach((schedule) => {
    const baseStart = toDate(schedule?.[scheduleConfig.startTimeField]);
    const baseEnd = toDate(schedule?.[scheduleConfig.endTimeField]);

    if (!baseStart) {
      return;
    }

    const isRecurring = Boolean(schedule[scheduleConfig.isRecurringField]);
    const recurrenceStart = isRecurring
      ? parseLocalDateKey(schedule[scheduleConfig.recurrenceStartsOnField])
      : null;
    const recurrenceEndBefore = isRecurring
      ? parseLocalDateKey(schedule[scheduleConfig.recurrenceEndsBeforeField])
      : null;
    const scheduleStart = recurrenceStart ?? baseStart;
    const scheduleEnd = recurrenceEndBefore
      ? addDays(recurrenceEndBefore, -1)
      : baseEnd ?? baseStart;

    if (!rangeStart || scheduleStart < rangeStart) {
      rangeStart = scheduleStart;
    }

    if (!rangeEnd || scheduleEnd > rangeEnd) {
      rangeEnd = scheduleEnd;
    }
  });

  return rangeStart && rangeEnd ? { rangeEnd, rangeStart } : null;
};

const getVisibleDates = (anchorDate, viewMode) => {
  if (viewMode === 'week') {
    const firstDate = startOfWeek(anchorDate);

    return Array.from({ length: 7 }, (_, index) => addDays(firstDate, index));
  }

  const firstOfMonth = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    1,
  );
  const firstGridDate = startOfWeek(firstOfMonth);

  return Array.from({ length: 42 }, (_, index) => addDays(firstGridDate, index));
};

const getHeading = (anchorDate, visibleDates, viewMode) => {
  if (viewMode === 'month') {
    return monthHeadingFormatter.format(anchorDate);
  }

  const firstDate = visibleDates[0];
  const lastDate = visibleDates[visibleDates.length - 1];

  return `${weekHeadingFormatter.format(firstDate)} - ${weekHeadingFormatter.format(lastDate)}`;
};

const ArrowIcon = ({ direction }) => (
  <svg
    aria-hidden="true"
    className={`h-4 w-4 ${direction === 'next' ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      d="m15 18-6-6 6-6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const Calendar = ({
  canManage = false,
  className = '',
  error = '',
  isLoading = false,
  onModifyOccurrence,
  onRemoveOccurrence,
  onRemoveSchedule,
  schedules = [],
  tasks = [],
  title = 'Meeting calendar',
}) => {
  const [viewMode, setViewMode] = useState('month');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedOccurrenceKey, setSelectedOccurrenceKey] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [meetingType, setMeetingType] = useState('all');
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const visibleDates = useMemo(
    () => getVisibleDates(anchorDate, viewMode),
    [anchorDate, viewMode],
  );
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const meetingOptions = useMemo(() => {
    const meetingsByTaskId = new Map();

    schedules.forEach((schedule) => {
      if (!scheduleMatchesMeetingType(schedule, meetingType)) {
        return;
      }

      const taskId = schedule?.[scheduleConfig.taskIdField];

      if (!taskId || meetingsByTaskId.has(taskId)) {
        return;
      }

      meetingsByTaskId.set(taskId, {
        label: tasksById.get(taskId)?.[taskConfig.nameField] ?? String(taskId),
        value: taskId,
      });
    });

    return [...meetingsByTaskId.values()].sort((left, right) => (
      left.label.localeCompare(right.label)
      || String(left.value).localeCompare(String(right.value))
    ));
  }, [meetingType, schedules, tasksById]);
  const selectedMeeting = meetingOptions.find((option) => (
    option.value === selectedMeetingId
  )) ?? null;
  const selectedMeetingSchedules = useMemo(() => (
    selectedMeeting
      ? schedules.filter((schedule) => (
          schedule?.[scheduleConfig.taskIdField] === selectedMeeting.value
          && scheduleMatchesMeetingType(schedule, meetingType)
        ))
      : []
  ), [meetingType, schedules, selectedMeeting]);
  const selectedMeetingOccurrences = useMemo(() => {
    const occurrenceRange = getOccurrenceRange(selectedMeetingSchedules);

    if (!occurrenceRange) {
      return [];
    }

    return getScheduleOccurrencesInRange(
      selectedMeetingSchedules,
      occurrenceRange.rangeStart,
      occurrenceRange.rangeEnd,
    ).sort((left, right) => (
      right.startTime - left.startTime
      || String(right.schedule.id ?? '').localeCompare(String(left.schedule.id ?? ''))
    ));
  }, [selectedMeetingSchedules]);
  const occurrences = useMemo(() => {
    return getScheduleOccurrencesInRange(
      schedules,
      visibleDates[0],
      visibleDates[visibleDates.length - 1],
    ).filter((occurrence) => {
      const schedule = occurrence.schedule;
      const taskId = schedule[scheduleConfig.taskIdField];

      return scheduleMatchesMeetingType(schedule, meetingType)
        && (!selectedMeeting || taskId === selectedMeeting.value);
    });
  }, [meetingType, schedules, selectedMeeting, visibleDates]);
  const occurrencesByDate = useMemo(() => {
    const groupedOccurrences = new Map();

    occurrences.forEach((occurrence) => {
      const existingOccurrences = groupedOccurrences.get(occurrence.dateKey) ?? [];
      existingOccurrences.push(occurrence);
      groupedOccurrences.set(occurrence.dateKey, existingOccurrences);
    });

    return groupedOccurrences;
  }, [occurrences]);
  const selectedOccurrence = occurrences.find((occurrence) => (
    `${occurrence.schedule.id}:${occurrence.dateKey}` === selectedOccurrenceKey
  )) ?? null;
  const todayKey = toDateInputValue(new Date());
  const heading = getHeading(anchorDate, visibleDates, viewMode);

  const getTaskName = (occurrence) => {
    const taskId = occurrence.schedule[scheduleConfig.taskIdField];
    return (
      tasksById.get(taskId)?.[taskConfig.nameField]
      ?? taskId
      ?? 'Meeting'
    );
  };

  const moveCalendar = (direction) => {
    setAnchorDate((currentDate) => {
      const nextDate = new Date(currentDate);

      if (viewMode === 'month') {
        nextDate.setDate(1);
        nextDate.setMonth(nextDate.getMonth() + direction);
      } else {
        nextDate.setDate(nextDate.getDate() + (7 * direction));
      }

      return nextDate;
    });
    setSelectedOccurrenceKey('');
    setActionError('');
    setActionMessage('');
  };

  const handleRemoveOccurrence = async () => {
    if (
      !selectedOccurrence
      || !onRemoveOccurrence
      || !window.confirm('Remove this meeting on the selected date? The rest of the series will remain.')
    ) {
      return;
    }

    setPendingAction('occurrence');
    setActionError('');
    setActionMessage('');

    try {
      await onRemoveOccurrence({
        occurrenceDate: selectedOccurrence.dateKey,
        schedule: selectedOccurrence.schedule,
      });
      setSelectedOccurrenceKey('');
      setActionMessage('The selected meeting date was removed.');
    } catch (removeError) {
      setActionError(removeError?.message || 'Failed to remove this meeting date.');
    } finally {
      setPendingAction('');
    }
  };

  const handleRemoveSchedule = async () => {
    if (!selectedOccurrence || !onRemoveSchedule) {
      return;
    }

    const confirmationMessage = selectedOccurrence.isRecurring
      ? 'Remove this entire recurring meeting? Every occurrence in the series will be removed.'
      : 'Remove this meeting?';

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setPendingAction('schedule');
    setActionError('');
    setActionMessage('');

    try {
      await onRemoveSchedule(selectedOccurrence.schedule);
      setSelectedOccurrenceKey('');
      setActionMessage(
        selectedOccurrence.isRecurring
          ? 'The recurring meeting series was removed.'
          : 'The meeting was removed.',
      );
    } catch (removeError) {
      setActionError(removeError?.message || 'Failed to remove this meeting.');
    } finally {
      setPendingAction('');
    }
  };

  return (
    <article className={className}>
      <div className="flex flex-col gap-5 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-lg font-semibold text-on-primary">{title}</p>
          <p className="mt-2 text-sm leading-6 text-on-primary/85">
            Browse one-time and recurring meetings in month or week view.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div
            aria-label="Calendar view"
            className="inline-flex rounded-xl border border-border bg-primary/40 p-1"
            role="group"
          >
            {['month', 'week'].map((mode) => (
              <button
                aria-pressed={viewMode === mode}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                  viewMode === mode
                    ? 'bg-accent text-on-accent'
                    : 'text-on-primary hover:bg-on-primary/10'
                }`}
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  setSelectedOccurrenceKey('');
                  setActionError('');
                  setActionMessage('');
                }}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-on-secondary transition hover:opacity-90"
            onClick={() => {
              setAnchorDate(new Date());
              setSelectedOccurrenceKey('');
              setActionError('');
              setActionMessage('');
            }}
            type="button"
          >
            Today
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <Dropdown
          label="Search meetings"
          onChange={(meetingId) => {
            setSelectedMeetingId(meetingId);
            setSelectedOccurrenceKey('');
            setActionError('');
            setActionMessage('');
          }}
          options={meetingOptions}
          placeholder="Select a meeting"
          searchable
          searchPlaceholder="Search by meeting name"
          value={selectedMeeting?.value ?? ''}
        />

        <div
          aria-label="Meeting type filter"
          className="inline-flex flex-wrap rounded-xl border border-border bg-primary/40 p-1"
          role="group"
        >
          {meetingTypeOptions.map((option) => (
            <button
              aria-pressed={meetingType === option.value}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                meetingType === option.value
                  ? 'bg-accent text-on-accent'
                  : 'text-on-primary hover:bg-on-primary/10'
              }`}
              key={option.value}
              onClick={() => {
                setMeetingType(option.value);
                setSelectedMeetingId('');
                setSelectedOccurrenceKey('');
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {(error || actionError) && (
        <p className="mt-5 rounded-xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
          {actionError || error}
        </p>
      )}

      {actionMessage && !error && !actionError && (
        <p className="mt-5 rounded-xl border border-border bg-primary/35 px-4 py-3 text-sm text-on-primary">
          {actionMessage}
        </p>
      )}

      {selectedMeeting && (
        <section className="mt-5 rounded-2xl border border-border bg-primary/25 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-base font-semibold text-on-primary">{selectedMeeting.label}</p>
              <p className="mt-1 text-sm text-on-primary/75">Meeting dates, newest first</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-on-primary/75">
                {selectedMeetingOccurrences.length} {selectedMeetingOccurrences.length === 1 ? 'date' : 'dates'}
              </p>
              <button
                className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-on-secondary transition hover:opacity-90"
                onClick={() => {
                  setSelectedMeetingId('');
                  setSelectedOccurrenceKey('');
                }}
                type="button"
              >
                Show all meetings
              </button>
            </div>
          </div>

          {selectedMeetingOccurrences.length === 0 ? (
            <p className="mt-4 rounded-xl border border-border bg-primary/35 px-4 py-4 text-sm text-on-primary/80">
              No scheduled dates are available for this meeting.
            </p>
          ) : (
            <div
              aria-label={`${selectedMeeting.label} meeting dates`}
              className="mt-4 max-h-[22.5rem] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-primary/35"
            >
              {selectedMeetingOccurrences.map((occurrence) => {
                const occurrenceKey = `${occurrence.schedule.id}:${occurrence.dateKey}`;
                const isSelected = occurrenceKey === selectedOccurrenceKey;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={`flex min-h-[4.5rem] w-full items-center justify-between gap-4 px-4 py-3 text-left transition ${
                      isSelected
                        ? 'bg-accent text-on-accent'
                        : 'text-on-primary hover:bg-accent/15'
                    }`}
                    key={occurrenceKey}
                    onClick={() => {
                      setAnchorDate(new Date(occurrence.startTime));
                      setSelectedOccurrenceKey(occurrenceKey);
                      setActionError('');
                      setActionMessage('');
                    }}
                    type="button"
                  >
                    <span>
                      <span className="block font-semibold">
                        {occurrenceDateFormatter.format(occurrence.startTime)}
                      </span>
                      <span className="mt-1 block text-sm opacity-80">
                        {dayDetailFormatter.format(occurrence.startTime)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      {timeFormatter.format(occurrence.startTime)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          aria-label={`Previous ${viewMode}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-on-secondary transition hover:opacity-90"
          onClick={() => moveCalendar(-1)}
          type="button"
        >
          <ArrowIcon direction="previous" />
        </button>
        <h2 className="text-center text-lg font-semibold text-on-primary sm:text-xl">
          {heading}
        </h2>
        <button
          aria-label={`Next ${viewMode}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-on-secondary transition hover:opacity-90"
          onClick={() => moveCalendar(1)}
          type="button"
        >
          <ArrowIcon direction="next" />
        </button>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-border">
            {weekdayLabels.map((weekday) => (
              <div
                className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-on-primary/80"
                key={weekday}
              >
                {weekday}
              </div>
            ))}
          </div>

          {isLoading ? (
            <p className="mt-4 rounded-xl border border-border bg-primary/35 px-4 py-8 text-center text-sm text-on-primary/80">
              Loading meetings...
            </p>
          ) : (
            <div className="grid grid-cols-7 border-l border-t border-border">
              {visibleDates.map((date) => {
                const dateKey = toDateInputValue(date);
                const dayOccurrences = occurrencesByDate.get(dateKey) ?? [];
                const isOutsideMonth = (
                  viewMode === 'month'
                  && date.getMonth() !== anchorDate.getMonth()
                );
                return (
                  <div
                    className={`min-h-32 border-b border-r border-border p-2 ${
                      isOutsideMonth ? 'bg-background/35' : 'bg-primary/25'
                    }`}
                    key={dateKey}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-semibold ${
                          dateKey === todayKey
                            ? 'bg-accent text-on-accent'
                            : isOutsideMonth
                              ? 'text-on-primary/45'
                              : 'text-on-primary'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {dayOccurrences.map((occurrence) => {
                        const occurrenceKey = `${occurrence.schedule.id}:${occurrence.dateKey}`;
                        const isSelected = occurrenceKey === selectedOccurrenceKey;

                        return (
                          <button
                            aria-label={`${getTaskName(occurrence)} at ${timeFormatter.format(occurrence.startTime)}`}
                            className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                              isSelected
                                ? 'border-on-accent bg-accent text-on-accent'
                                : 'border-accent/35 bg-accent/14 text-on-primary hover:bg-accent/25'
                            }`}
                            key={occurrenceKey}
                            onClick={() => {
                              setSelectedOccurrenceKey(occurrenceKey);
                              setActionError('');
                              setActionMessage('');
                            }}
                            type="button"
                          >
                            <span className="block truncate font-semibold">
                              {getTaskName(occurrence)}
                            </span>
                            <span className="mt-0.5 block truncate opacity-85">
                              {timeFormatter.format(occurrence.startTime)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {!isLoading && occurrences.length === 0 && (
        <p className="mt-4 rounded-xl border border-border bg-primary/35 px-4 py-4 text-sm text-on-primary/80">
          No meetings match the current selection and filter in this {viewMode}.
        </p>
      )}

      {selectedOccurrence && (
        <div className="mt-5 rounded-2xl border border-accent/35 bg-accent/12 p-4 text-on-primary">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-base font-semibold">
                {getTaskName(selectedOccurrence)}
              </p>
              <p className="mt-1 text-sm text-on-primary/85">
                {dayDetailFormatter.format(selectedOccurrence.startTime)}
              </p>
              <p className="mt-1 text-sm text-on-primary/85">
                {timeFormatter.format(selectedOccurrence.startTime)} - {timeFormatter.format(selectedOccurrence.endTime)}
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-primary/70">
                {getScheduleRecurrenceLabel(selectedOccurrence.schedule)}
                {isAttendanceSchedule(selectedOccurrence.schedule)
                  ? ' / Attendance'
                  : ''}
                {isOutreachSchedule(selectedOccurrence.schedule)
                  ? ' / Outreach'
                  : ''}
                {!isAttendanceSchedule(selectedOccurrence.schedule)
                  && !isOutreachSchedule(selectedOccurrence.schedule)
                  ? ' / Optional'
                  : ''}
              </p>
            </div>

            {canManage && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-on-secondary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={Boolean(pendingAction)}
                  onClick={() => onModifyOccurrence?.(selectedOccurrence)}
                  type="button"
                >
                  Modify event
                </button>
                {selectedOccurrence.isRecurring && (
                  <button
                    className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-on-secondary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(pendingAction)}
                    onClick={handleRemoveOccurrence}
                    type="button"
                  >
                    {pendingAction === 'occurrence' ? 'Removing...' : 'Remove this date'}
                  </button>
                )}
                <button
                  className="rounded-xl border border-accent bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={Boolean(pendingAction)}
                  onClick={handleRemoveSchedule}
                  type="button"
                >
                  {pendingAction === 'schedule'
                    ? 'Removing...'
                    : selectedOccurrence.isRecurring
                      ? 'Remove entire series'
                      : 'Remove event'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

export default Calendar;
