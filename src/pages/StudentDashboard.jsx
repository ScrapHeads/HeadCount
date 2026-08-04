import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/shared/Button';
import Calendar from '../components/shared/Calendar';
import {
  extraTimeRequestConfig,
  scheduleConfig,
  studentAuthConfig,
  timeLogConfig,
} from '../config/appConfig';
import { branding } from '../config/branding';
import { ROUTES } from '../config/routesConfig';
import { useAuth } from '../features/auth/useAuth.jsx';
import { createExtraTimeRequest } from '../features/extraTimeRequests/extraTimeRequestService';
import { useStudentExtraTimeRequests } from '../features/extraTimeRequests/useExtraTimeRequests';
import { useSchedules } from '../features/schedules/useSchedules';
import {
  isAttendanceSchedule,
  isOutreachSchedule,
} from '../features/schedules/scheduleUtils';
import { isScheduleActive } from '../features/schedules/validateSchedule';
import { useTasks } from '../features/tasks/useTasks';
import { useStudentTimeLogs } from '../features/timeLogs/useStudentTimeLogs';
import {
  calculateHoursByCategory,
  formatHours,
  formatTaskName,
  getDurationMinutes,
  getEndOfDay,
  getLogsInDateRange,
  getStartOfDay,
  minutesToHours,
} from '../lib/analyticsUtils';
import { MISSING_VALUE_LABEL } from '../lib/constants';
import {
  formatDateTime,
  formatSignedInAt,
  getDefaultDateRange,
} from '../lib/dateUtils';
import {
  DASHBOARD_GRADIENT_CLASS_NAME,
  DASHBOARD_TABLE_HEADER_CLASS_NAME,
} from '../styles/classNames';

const inputClassName = 'w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-on-secondary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20';
const studentCardClassName = `rounded-2xl border border-on-primary/15 ${DASHBOARD_GRADIENT_CLASS_NAME} p-5 text-on-primary shadow-lg shadow-primary/15`;
const timelineCellClassName = 'border-y border-border bg-transparent px-5 py-3 text-on-secondary text-center';
const timelineMeetingTypeOptions = [
  { label: 'All meetings', value: 'all' },
  { label: 'Attendance', value: 'attendance' },
  { label: 'Outreach', value: 'outreach' },
];
const StudentAnalyticsCard = ({
  analytics,
  dateRange,
  error,
  isLoading,
  onDateChange,
}) => (
  <article className={studentCardClassName}>
    <div className="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="font-semibold uppercase tracking-[0.18em] text-on-primary">
          Your Hours
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight">
          {formatHours(analytics.totalHours)} hours
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-primary">Start Date</span>
          <input
            className={inputClassName}
            onChange={(event) => onDateChange('startDate', event.target.value)}
            type="date"
            value={dateRange.startDate}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-primary">End Date</span>
          <input
            className={inputClassName}
            onChange={(event) => onDateChange('endDate', event.target.value)}
            type="date"
            value={dateRange.endDate}
          />
        </label>
      </div>
    </div>

    {isLoading ? (
      <p className="mt-5 rounded-xl border border-border bg-primary px-4 py-3 text-sm text-on-primary/80">
        Loading your hours...
      </p>
    ) : error ? (
      <p className="mt-5 rounded-xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
        {error}
      </p>
    ) : analytics.categories.length === 0 ? (
      <p className="mt-5 rounded-xl border border-border bg-primary px-4 py-3 text-sm text-on-primary/80">
        No completed hours were found for this date range.
      </p>
    ) : (
      <div className="mt-5 space-y-4">
        {analytics.categories.map((category) => (
          <div key={category.categoryKey}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{category.taskName}</span>
              <span className="shrink-0 tabular-nums">
                {formatHours(category.totalHours)} hrs
              </span>
            </div>
            <div className="h-3 rounded-full bg-primary/55">
              <div
                aria-label={`${category.taskName}: ${formatHours(category.totalHours)} hours`}
                className="h-3 rounded-full bg-accent"
                role="img"
                style={{ width: `${Math.max(4, category.percentage)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    )}
  </article>
);

const StudentSessionTimeline = ({ error, isLoading, logs, schedules = [] }) => {
  const [meetingType, setMeetingType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const filteredLogs = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();

    return logs.filter((log) => {
      const taskId = String(log?.[timeLogConfig.taskIdField] ?? '').trim();
      const signInAt = log?.[timeLogConfig.signInAtField];
      const matchesMeetingType = meetingType === 'all' || schedules.some((schedule) => (
        String(schedule?.[scheduleConfig.taskIdField] ?? '').trim() === taskId
        && isScheduleActive(schedule, signInAt)
        && (
          (meetingType === 'attendance' && isAttendanceSchedule(schedule))
          || (meetingType === 'outreach' && isOutreachSchedule(schedule))
        )
      ));

      if (!matchesMeetingType) {
        return false;
      }

      if (!normalizedSearchTerm) {
        return true;
      }

      const isActive = log[timeLogConfig.statusField] === timeLogConfig.activeStatus;
      const searchableValues = [
        formatTaskName(log[timeLogConfig.taskNameField], 'Task'),
        isActive ? 'Active' : 'Completed',
        formatDateTime(log[timeLogConfig.signInAtField]),
        formatDateTime(log[timeLogConfig.signOutAtField]),
      ];

      return searchableValues.some((value) => (
        String(value).toLocaleLowerCase().includes(normalizedSearchTerm)
      ));
    });
  }, [logs, meetingType, schedules, searchTerm]);

  return (
    <article className={studentCardClassName}>
      <div className="flex flex-col gap-4 border-b border-on-primary/15 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-semibold uppercase tracking-[0.18em] text-on-primary">
            Session Timeline
          </p>
          <p className="mt-2 leading-6 text-on-primary/90">
            Review your sessions in the selected date range. These records are read-only.
          </p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end md:max-w-3xl">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-primary">
              Search sessions
            </span>
            <input
              className={inputClassName}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by task, status, or date"
              type="search"
              value={searchTerm}
            />
          </label>

          <div
            aria-label="Session timeline meeting type"
            className="inline-flex flex-wrap self-start rounded-xl border border-border bg-primary/40 p-1 sm:self-end"
            role="group"
          >
            {timelineMeetingTypeOptions.map((option) => (
              <button
                aria-pressed={meetingType === option.value}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  meetingType === option.value
                    ? 'bg-accent text-on-accent'
                    : 'text-on-primary hover:bg-on-primary/10'
                }`}
                key={option.value}
                onClick={() => setMeetingType(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-5 rounded-xl border border-border bg-primary px-4 py-3 text-sm text-on-primary">
          Loading your sessions...
        </p>
      ) : error ? (
        <p className="mt-5 rounded-xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
          {error}
        </p>
      ) : logs.length === 0 ? (
        <p className="mt-5 rounded-xl border border-border bg-primary px-4 py-3 text-sm text-on-primary">
          No sessions were found for this date range.
        </p>
      ) : filteredLogs.length === 0 ? (
        <p className="mt-5 rounded-xl border border-border bg-primary px-4 py-3 text-sm text-on-primary">
          No sessions match the current search and filter.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Task</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Status</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Start</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>End</th>
                <th className={`${DASHBOARD_TABLE_HEADER_CLASS_NAME} !text-center`}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const isActive = log[timeLogConfig.statusField] === timeLogConfig.activeStatus;
                const durationMinutes = getDurationMinutes(log);

                return (
                  <tr key={log.id}>
                    <td className={`${timelineCellClassName} rounded-l-2xl border-l font-semibold`}>
                      {formatTaskName(log[timeLogConfig.taskNameField], 'Task')}
                    </td>
                    <td className={timelineCellClassName}>{isActive ? 'Active' : 'Completed'}</td>
                    <td className={`${timelineCellClassName} whitespace-nowrap`}>
                      {formatDateTime(log[timeLogConfig.signInAtField])}
                    </td>
                    <td className={`${timelineCellClassName} whitespace-nowrap`}>
                      {formatDateTime(log[timeLogConfig.signOutAtField])}
                    </td>
                    <td className={`${timelineCellClassName} rounded-r-2xl border-r font-semibold`}>
                      {durationMinutes > 0 ? minutesToHours(durationMinutes).toFixed(2) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
};

const ExtraTimeRequestCard = ({ student }) => {
  const [hours, setHours] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const { requests, isLoading, error } = useStudentExtraTimeRequests(student);
  const latestRequest = requests[0] ?? null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage('');

    try {
      await createExtraTimeRequest({ hours, reason, student });
      setHours('');
      setReason('');
      setStatusMessage('Extra-time request submitted for coach review.');
    } catch (submitError) {
      setStatusMessage(submitError?.message || 'Failed to submit the extra-time request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className={studentCardClassName}>
      <p className="font-semibold uppercase tracking-[0.18em] text-on-primary">
        Extra Time Request
      </p>
      <p className="mt-2 text-sm leading-6 text-on-primary/90">
        Request manual hours for a coach to approve.
      </p>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-primary">
            Hours
          </span>
          <input
            className={inputClassName}
            min="0.01"
            onChange={(event) => {
              setHours(event.target.value);
              setStatusMessage('');
            }}
            placeholder="1.5"
            required
            step="0.01"
            type="number"
            value={hours}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-primary">
            Reason
          </span>
          <textarea
            className={`${inputClassName} min-h-24`}
            onChange={(event) => {
              setReason(event.target.value);
              setStatusMessage('');
            }}
            placeholder="Describe the work completed"
            required
            value={reason}
          />
        </label>
        <Button
          className="bg-secondary text-on-secondary"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Submitting...' : 'Request Extra Time'}
        </Button>
      </form>

      {(statusMessage || error) && (
        <p className="mt-4 rounded-xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
          {statusMessage || error}
        </p>
      )}

      {isLoading ? (
        <p className="mt-4 text-sm text-on-primary/80">Loading request status...</p>
      ) : latestRequest ? (
        <p className="mt-4 text-sm text-on-primary/90">
          Latest request: <span className="font-semibold capitalize">
            {latestRequest[extraTimeRequestConfig.statusField]}
          </span>
        </p>
      ) : null}
    </article>
  );
};

const StudentDashboard = () => {
  const { signOutStudent, studentSession } = useAuth();
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const navigate = useNavigate();
  const {
    schedules,
    isLoading: isLoadingSchedules,
    error: schedulesError,
  } = useSchedules();
  const {
    tasks,
    isLoading: isLoadingTasks,
    error: tasksError,
  } = useTasks();
  const isSignedIn = Boolean(studentSession?.[studentAuthConfig.signedInField]);
  const studentId = (
    studentSession?.[studentAuthConfig.idField]
    ?? studentSession?.studentId
    ?? MISSING_VALUE_LABEL
  );
  const currentTask = studentSession?.[studentAuthConfig.currentTaskField] ?? 'No active task';
  // Parse and validate the form values once, then reuse the same local-day
  // boundaries for the timeline and summary cards.
  const parsedDateRange = useMemo(() => {
    const startDate = getStartOfDay(dateRange.startDate);
    const endDate = getEndOfDay(dateRange.endDate);
    let error = '';

    if (!startDate || !endDate) {
      error = 'Select a valid start date and end date.';
    } else if (startDate > endDate) {
      error = 'Start date must be on or before end date.';
    }

    return {
      startDate,
      endDate,
      error,
    };
  }, [dateRange.endDate, dateRange.startDate]);
  const {
    logs,
    isLoading: isLoadingTimeLogs,
    error: timeLogsError,
  } = useStudentTimeLogs({
    student: studentSession,
    enabled: Boolean(studentSession?.id) && !parsedDateRange.error,
  });
  const analyticsError = parsedDateRange.error || timeLogsError;
  const logsInDateRange = useMemo(() => (
    analyticsError
      ? []
      : getLogsInDateRange(logs, parsedDateRange.startDate, parsedDateRange.endDate)
  ), [analyticsError, logs, parsedDateRange.endDate, parsedDateRange.startDate]);
  // The service loads raw logs. The page derives display-ready summaries in
  // memory so changing the date range does not write anything to Firestore.
  const hoursAnalytics = useMemo(
    () => calculateHoursByCategory(logsInDateRange),
    [logsInDateRange],
  );

  const handleDateChange = (field, value) => {
    setDateRange((currentRange) => ({
      ...currentRange,
      [field]: value,
    }));
  };

  const handleOpenHoursForm = () => {
    navigate(ROUTES.studentSession);
  };

  const handleDashboardSignOut = async () => {
    const destination = studentSession?.authMode === 'kiosk'
      ? ROUTES.kiosk
      : ROUTES.accessPortal;

    await signOutStudent();
    navigate(destination, { replace: true });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-border bg-primary shadow-2xl shadow-primary/10">
        <header className="border-b border-on-primary/15 bg-[linear-gradient(135deg,var(--app-primary)_0%,color-mix(in_oklab,var(--app-primary)_72%,var(--app-accent))_58%,var(--app-accent)_100%)] p-6 text-on-primary sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-primary/80">
                Student Dashboard
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {branding.appName}
              </h1>
              <p className="mt-3 text-sm leading-6 text-on-primary/80 sm:text-base">
                Welcome, <span className="font-semibold text-on-primary">{studentSession?.name ?? 'Student'}</span>.
              </p>
            </div>
            <Button
              className="bg-secondary text-on-secondary shadow-none hover:bg-secondary/90 lg:w-auto"
              onClick={handleDashboardSignOut}
              type="button"
            >
              Sign Out
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-6 sm:p-8">
          <section className="grid gap-6 lg:grid-cols-3">
            <article className={studentCardClassName}>
              <p className="font-semibold uppercase tracking-[0.18em] text-on-primary">
                Current Status
              </p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-3xl font-semibold tracking-tight">
                    {isSignedIn ? 'Signed In' : 'Not Signed In'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-on-primary/75">
                    {isSignedIn ? currentTask : 'No active hours session is open.'}
                  </p>
                  <dl className="mt-4">
                    <dt className="text-sm font-semibold uppercase text-on-primary">Signed In At</dt>
                    <dd className="mt-1 text-base font-semibold">
                      {isSignedIn ? formatSignedInAt(studentSession?.[studentAuthConfig.signedInAtField]) : 'Not signed in'}
                    </dd>
                  </dl>
                </div>
              </div>
            </article>

            <article className={studentCardClassName}>
              <p className="font-semibold uppercase tracking-[0.18em] text-on-primary">
                Account Details
              </p>
              <dl className="mt-4 grid gap-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-on-primary/90">Name</dt>
                  <dd className="mt-1 text-base font-semibold">{studentSession?.name ?? 'Student'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-on-primary/90">Student ID</dt>
                  <dd className="mt-1 text-base font-semibold">{studentId}</dd>
                </div>
              </dl>
            </article>

            <div className={studentCardClassName}>
              <p className="font-semibold uppercase tracking-[0.18em] text-on-primary">
                Hours
              </p>
              <p className="mt-3 text-lg font-semibold">
                {isSignedIn ? 'Complete your active session' : 'Start a team hours session'}
              </p>
              <Button className="mt-5 bg-secondary text-on-secondary" onClick={handleOpenHoursForm} type="button">
                {isSignedIn ? 'Open Sign-Out Form' : 'Open Sign-In Form'}
              </Button>
            </div>

          </section>

          <Calendar
            className={studentCardClassName}
            error={schedulesError || tasksError}
            isLoading={isLoadingSchedules || isLoadingTasks}
            schedules={schedules}
            tasks={tasks}
            title="Team meeting calendar"
          />

          <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <StudentAnalyticsCard
              analytics={hoursAnalytics}
              dateRange={dateRange}
              error={analyticsError}
              isLoading={isLoadingTimeLogs}
              onDateChange={handleDateChange}
            />
            <ExtraTimeRequestCard student={studentSession} />
          </section>

          <StudentSessionTimeline
            error={analyticsError}
            isLoading={isLoadingTimeLogs}
            logs={logsInDateRange}
            schedules={schedules}
          />
        </div>
      </section>
    </main>
  );
};

export default StudentDashboard;
