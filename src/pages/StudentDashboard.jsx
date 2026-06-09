import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/shared/Button';
import { studentAuthConfig } from '../config/appConfig';
import { branding } from '../config/branding';
import { useAuth } from '../features/auth/useAuth.jsx';
import { useStudentTimeLogs } from '../features/timeLogs/useStudentTimeLogs';
import {
  calculateHoursByCategory,
  getEndOfDay,
  getLogsInDateRange,
  getStartOfDay,
} from '../lib/analyticsUtils';
import { toDate } from '../lib/dateUtils';

const signedInFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatSignedInAt = (value) => {
  const parsedDate = toDate(value);
  return parsedDate ? signedInFormatter.format(parsedDate) : 'Not recorded';
};

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getDefaultDateRange = () => {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 29);

  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
  };
};

const formatHours = (hours) => Number(hours || 0).toFixed(1);

const inputClassName = 'w-full rounded-xl border border-border bg-primary px-4 py-3 text-sm text-on-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20';

const StudentAnalyticsCard = ({
  analytics,
  dateRange,
  error,
  isLoading,
  onDateChange,
}) => (
  <article className="rounded-2xl border border-border bg-secondary p-5 text-on-secondary shadow-sm">
    <div className="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
          Your Hours
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight">
          {formatHours(analytics.totalHours)} hours
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Start Date</span>
          <input
            className={inputClassName}
            onChange={(event) => onDateChange('startDate', event.target.value)}
            type="date"
            value={dateRange.startDate}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">End Date</span>
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
      <p className="mt-5 rounded-xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-secondary">
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

const StudentDashboard = () => {
  const { signOutStudent, studentSession } = useAuth();
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const navigate = useNavigate();
  const isSignedIn = Boolean(studentSession?.[studentAuthConfig.signedInField]);
  const studentId = studentSession?.[studentAuthConfig.idField] ?? studentSession?.studentId ?? 'Not set';
  const currentTask = studentSession?.[studentAuthConfig.currentTaskField] ?? 'No active task';
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
    navigate('/student/session');
  };

  const handleDashboardSignOut = async () => {
    const destination = studentSession?.authMode === 'kiosk' ? '/kiosk' : '/';

    await signOutStudent();
    navigate(destination, { replace: true });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-primary shadow-2xl shadow-primary/10">
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

        <div className="grid flex-1 gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-6">
            <article className="rounded-2xl border border-border bg-secondary p-5 text-on-secondary shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Current Status
              </p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-3xl font-semibold tracking-tight">
                    {isSignedIn ? 'Signed In' : 'Not Signed In'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-on-secondary/75">
                    {isSignedIn ? currentTask : 'No active hours session is open.'}
                  </p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                  isSignedIn
                    ? 'bg-primary text-on-primary'
                    : 'bg-accent/15 text-on-secondary'
                }`}
                >
                  {isSignedIn ? 'Active' : 'Ready'}
                </span>
              </div>
            </article>

            <article className="rounded-2xl border border-border bg-secondary p-5 text-on-secondary shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Account Details
              </p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Name</dt>
                  <dd className="mt-1 text-base font-semibold">{studentSession?.name ?? 'Student'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Student ID</dt>
                  <dd className="mt-1 text-base font-semibold">{studentId}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Signed In At</dt>
                  <dd className="mt-1 text-base font-semibold">
                    {isSignedIn ? formatSignedInAt(studentSession?.[studentAuthConfig.signedInAtField]) : 'Not signed in'}
                  </dd>
                </div>
              </dl>
            </article>

            <StudentAnalyticsCard
              analytics={hoursAnalytics}
              dateRange={dateRange}
              error={analyticsError}
              isLoading={isLoadingTimeLogs}
              onDateChange={handleDateChange}
            />
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-secondary p-5 text-on-secondary shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Hours
              </p>
              <p className="mt-3 text-lg font-semibold">
                {isSignedIn ? 'Complete your active session' : 'Start a team hours session'}
              </p>
              <Button className="mt-5 bg-primary text-on-primary" onClick={handleOpenHoursForm} type="button">
                {isSignedIn ? 'Open Sign-Out Form' : 'Open Sign-In Form'}
              </Button>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
};

export default StudentDashboard;
