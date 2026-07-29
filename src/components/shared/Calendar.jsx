import { useMemo, useState } from 'react';
import { scheduleConfig, taskConfig } from '../../config/appConfig';
import {
  getScheduleOccurrencesInRange,
  getScheduleRecurrenceLabel,
} from '../../features/schedules/scheduleUtils';
import { toDateInputValue } from '../../lib/dateUtils';

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
  const visibleDates = useMemo(
    () => getVisibleDates(anchorDate, viewMode),
    [anchorDate, viewMode],
  );
  const occurrences = useMemo(
    () => getScheduleOccurrencesInRange(
      schedules,
      visibleDates[0],
      visibleDates[visibleDates.length - 1],
    ),
    [schedules, visibleDates],
  );
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
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
          No meetings are scheduled in this {viewMode}.
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
                {selectedOccurrence.schedule[scheduleConfig.countsForAttendanceField] === false
                  ? ' / Optional'
                  : ' / Attendance'}
              </p>
            </div>

            {canManage && (
              <div className="flex flex-col gap-2 sm:flex-row">
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
