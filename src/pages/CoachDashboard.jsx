import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/shared/Button';
import { branding } from '../config/branding';
import { scheduleConfig, studentAuthConfig, taskConfig } from '../config/appConfig';
import { useAuth } from '../features/auth/useAuth.jsx';
import { useSchedules } from '../features/schedules/useSchedules';
import { createSchedule } from '../features/schedules/scheduleService';
import { useActiveStudents } from '../features/students/useStudents';
import { useTasks } from '../features/tasks/useTasks';
import { createTask } from '../features/tasks/taskService';
import { endStudentSessionByCoach } from '../features/timeLogs/timeLogService';
import { toDate } from '../lib/dateUtils';

const navItems = [
  {
    id: 'home',
    label: 'Home',
    eyebrow: 'Overview',
    title: 'Coach home base',
    description: 'Track live session health, confirm the team is using the kiosk correctly, and jump into the areas that need attention.',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    eyebrow: 'Planning',
    title: 'Schedule management',
    description: 'Create and tune scheduled work blocks so students only see the right tasks at the right time.',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    eyebrow: 'Reporting',
    title: 'Hours and trends',
    description: 'Review team participation, compare sessions over time, and surface students who may need follow-up.',
  },
];

const dashboardCards = {
  analytics: [
    {
      title: 'Hours summary',
      body: 'This section should aggregate completed time logs by student, task, date range, and total minutes so coaches can review participation quickly.',
    },
    {
      title: 'Trend views',
      body: 'Useful charts here would include hours by week, most-selected tasks, and students with open sessions that never reached sign-out.',
    },
  ],
};

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

const scheduleDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatScheduleDateTime = (value) => {
  const parsedDate = toDate(value);
  return parsedDate ? scheduleDateTimeFormatter.format(parsedDate) : 'Not scheduled';
};

const weekdayOptions = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const monthOptions = [
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' },
];

const dayOfMonthOptions = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));

const taskSourceOptions = [
  {
    value: 'existing',
    title: 'Use Existing',
    description: 'Attach the event to a task that already exists in the system.',
  },
  {
    value: 'new',
    title: 'Create New',
    description: 'Make a new scheduled task first, then attach the event to it.',
  },
];

const scheduleTypeOptions = [
  {
    value: scheduleConfig.recurrenceTypes.oneTime,
    title: 'One-Time',
    description: 'A single event with explicit start and end dates.',
  },
  {
    value: scheduleConfig.recurrenceTypes.weekly,
    title: 'Weekly',
    description: 'Repeats every week on the selected weekday.',
  },
  {
    value: scheduleConfig.recurrenceTypes.monthly,
    title: 'Monthly',
    description: 'Repeats each month on the selected day of month.',
  },
  {
    value: scheduleConfig.recurrenceTypes.yearly,
    title: 'Yearly',
    description: 'Repeats once a year on the selected month and day.',
  },
];

const buildDateTimeFromForm = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) {
    return null;
  }

  return new Date(`${dateValue}T${timeValue}`);
};

const buildRecurringDateTime = (timeValue) => {
  if (!timeValue) {
    return null;
  }

  return new Date(`2000-01-02T${timeValue}`);
};

const isValidMonthDay = (year, month, dayOfMonth) => {
  const candidateDate = new Date(year, month, dayOfMonth);

  return (
    candidateDate.getFullYear() === year
    && candidateDate.getMonth() === month
    && candidateDate.getDate() === dayOfMonth
  );
};

const buildRecurringOccurrenceStart = ({ schedule, fromDate = new Date() }) => {
  const baseStart = toDate(schedule[scheduleConfig.startTimeField]);
  const baseEnd = toDate(schedule[scheduleConfig.endTimeField]);
  const recurrenceType = schedule[scheduleConfig.recurrenceTypeField]
    ?? scheduleConfig.recurrenceTypes.weekly;
  const durationMs = baseEnd?.getTime() - baseStart?.getTime();

  if (!baseStart || !baseEnd || Number.isNaN(durationMs)) {
    return null;
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.weekly) {
    const targetDay = Number(schedule[scheduleConfig.dayOfWeekField]);
    const currentDay = fromDate.getDay();
    let daysUntilTarget = targetDay - currentDay;

    if (daysUntilTarget < 0) {
      daysUntilTarget += 7;
    }

    const occurrenceStart = new Date(fromDate);
    occurrenceStart.setHours(
      baseStart.getHours(),
      baseStart.getMinutes(),
      baseStart.getSeconds(),
      baseStart.getMilliseconds(),
    );
    occurrenceStart.setDate(fromDate.getDate() + daysUntilTarget);

    if (daysUntilTarget === 0 && occurrenceStart < fromDate && occurrenceStart.getTime() + durationMs >= fromDate.getTime()) {
      return occurrenceStart;
    }

    if (daysUntilTarget === 0 && occurrenceStart < fromDate) {
      occurrenceStart.setDate(occurrenceStart.getDate() + 7);
    }

    return occurrenceStart;
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.monthly) {
    const dayOfMonth = Number(schedule[scheduleConfig.dayOfMonthField]);

    for (let monthOffset = 0; monthOffset < 24; monthOffset += 1) {
      const year = fromDate.getFullYear() + Math.floor((fromDate.getMonth() + monthOffset) / 12);
      const month = (fromDate.getMonth() + monthOffset) % 12;

      if (!isValidMonthDay(year, month, dayOfMonth)) {
        continue;
      }

      const occurrenceStart = new Date(
        year,
        month,
        dayOfMonth,
        baseStart.getHours(),
        baseStart.getMinutes(),
        baseStart.getSeconds(),
        baseStart.getMilliseconds(),
      );

      if (occurrenceStart >= fromDate || occurrenceStart.getTime() + durationMs >= fromDate.getTime()) {
        return occurrenceStart;
      }
    }

    return null;
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.yearly) {
    const dayOfMonth = Number(schedule[scheduleConfig.dayOfMonthField]);
    const monthOfYear = Number(schedule[scheduleConfig.monthOfYearField]);

    for (let yearOffset = 0; yearOffset < 10; yearOffset += 1) {
      const year = fromDate.getFullYear() + yearOffset;

      if (!isValidMonthDay(year, monthOfYear, dayOfMonth)) {
        continue;
      }

      const occurrenceStart = new Date(
        year,
        monthOfYear,
        dayOfMonth,
        baseStart.getHours(),
        baseStart.getMinutes(),
        baseStart.getSeconds(),
        baseStart.getMilliseconds(),
      );

      if (occurrenceStart >= fromDate || occurrenceStart.getTime() + durationMs >= fromDate.getTime()) {
        return occurrenceStart;
      }
    }
  }

  return null;
};

const buildScheduleDisplayWindow = (schedule, now = new Date()) => {
  const startTime = toDate(schedule[scheduleConfig.startTimeField]);
  const endTime = toDate(schedule[scheduleConfig.endTimeField]);

  if (!startTime || !endTime) {
    return null;
  }

  if (!schedule[scheduleConfig.isRecurringField]) {
    if (endTime < now) {
      return null;
    }

    return {
      ...schedule,
      resolvedStartTime: startTime,
      resolvedEndTime: endTime,
      displayType: 'One-time',
    };
  }

  const nextOccurrenceStart = buildRecurringOccurrenceStart({ schedule, fromDate: now });

  if (!nextOccurrenceStart) {
    return null;
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  const nextOccurrenceEnd = new Date(nextOccurrenceStart.getTime() + durationMs);

  return {
    ...schedule,
    resolvedStartTime: nextOccurrenceStart,
    resolvedEndTime: nextOccurrenceEnd,
    displayType: recurrenceLabel(schedule),
  };
};

const recurrenceLabel = (schedule) => {
  const recurrenceType = schedule[scheduleConfig.recurrenceTypeField]
    ?? (schedule[scheduleConfig.isRecurringField] ? scheduleConfig.recurrenceTypes.weekly : scheduleConfig.recurrenceTypes.oneTime);

  if (recurrenceType === scheduleConfig.recurrenceTypes.oneTime) {
    return 'One-time';
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.weekly) {
    return `Weekly ${weekdayOptions.find((option) => option.value === String(schedule[scheduleConfig.dayOfWeekField]))?.label ?? ''}`.trim();
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.monthly) {
    return `Monthly day ${schedule[scheduleConfig.dayOfMonthField] ?? ''}`.trim();
  }

  if (recurrenceType === scheduleConfig.recurrenceTypes.yearly) {
    const monthLabel = monthOptions.find((option) => option.value === String(schedule[scheduleConfig.monthOfYearField]))?.label ?? '';
    return `Yearly ${monthLabel} ${schedule[scheduleConfig.dayOfMonthField] ?? ''}`.trim();
  }

  return 'Recurring';
};

// The coach dashboard is intentionally a shell for adopters. Keep layout and
// navigation stable here, then swap the section bodies to real Firestore-backed
// panels as each team customizes the demo.
const CoachDashboard = () => {
  const [activeSection, setActiveSection] = useState('home');
  const [endingStudentId, setEndingStudentId] = useState('');
  const [homeStatusMessage, setHomeStatusMessage] = useState('');
  const [scheduleForm, setScheduleForm] = useState({
    taskMode: 'existing',
    taskId: '',
    newTaskName: '',
    scheduleMode: 'one-time',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    recurringDayOfWeek: '1',
    recurringDayOfMonth: '1',
    recurringMonthOfYear: '0',
  });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleStatusMessage, setScheduleStatusMessage] = useState('');
  const { coachUser, signOutCoach } = useAuth();
  const { students: activeStudents, isLoading: isLoadingActiveStudents, error: activeStudentsError } = useActiveStudents();
  const { tasks, isLoading: isLoadingTasks, error: tasksError, reloadTasks } = useTasks();
  const { schedules, isLoading: isLoadingSchedules, error: schedulesError, reloadSchedules } = useSchedules();
  const navigate = useNavigate();

  const activeNavItem = useMemo(
    () => navItems.find((item) => item.id === activeSection) ?? navItems[0],
    [activeSection],
  );

  const sectionCards = useMemo(
    () => dashboardCards[activeSection] ?? [],
    [activeSection],
  );

  const upcomingSchedules = useMemo(() => {
    const now = new Date();

    return schedules
      .map((schedule) => buildScheduleDisplayWindow(schedule, now))
      .filter(Boolean)
      .sort((left, right) => left.resolvedStartTime - right.resolvedStartTime)
      .slice(0, 10);
  }, [schedules]);

  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  const homeStats = useMemo(() => {
    const activeCount = activeStudents.length;
    const uniqueSessionTypes = new Set(
      activeStudents.map((student) => student[studentAuthConfig.currentTaskField]).filter(Boolean),
    ).size;

    return {
      activeCount,
      uniqueSessionTypes,
      earliestSignIn: activeStudents[0]?.[studentAuthConfig.signedInAtField] ?? null,
    };
  }, [activeStudents]);

  const handleSignOut = async () => {
    await signOutCoach();
    navigate('/', { replace: true });
  };

  const handleEndSession = async (student) => {
    setEndingStudentId(student.id);
    setHomeStatusMessage('');

    try {
      await endStudentSessionByCoach({
        student,
        coachEmail: coachUser?.email,
      });
      setHomeStatusMessage(`Ended the session for ${student.name ?? 'the selected student'}.`);
    } catch (endSessionError) {
      setHomeStatusMessage(endSessionError.message || 'Failed to end the selected session.');
    } finally {
      setEndingStudentId('');
    }
  };

  const handleScheduleFieldChange = (field, value) => {
    setScheduleForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
    setScheduleStatusMessage('');
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();

    const isRecurring = scheduleForm.scheduleMode !== scheduleConfig.recurrenceTypes.oneTime;
    const startDateTime = isRecurring
      ? buildRecurringDateTime(scheduleForm.startTime)
      : buildDateTimeFromForm(scheduleForm.startDate, scheduleForm.startTime);
    const endDateTime = isRecurring
      ? buildRecurringDateTime(scheduleForm.endTime)
      : buildDateTimeFromForm(scheduleForm.endDate, scheduleForm.endTime);
    const useNewTask = scheduleForm.taskMode === 'new';

    if ((!useNewTask && !scheduleForm.taskId) || (useNewTask && !scheduleForm.newTaskName.trim()) || !startDateTime || !endDateTime) {
      setScheduleStatusMessage('Task details plus start and end time information are required.');
      return;
    }

    setIsSavingSchedule(true);
    setScheduleStatusMessage('');

    try {
      let taskId = scheduleForm.taskId;

      if (useNewTask) {
        const createdTask = await createTask({
          name: scheduleForm.newTaskName,
          scheduled: true,
        });
        taskId = createdTask.id;
      }

      await createSchedule({
        taskId,
        startTime: startDateTime,
        endTime: endDateTime,
        isRecurring,
        recurrenceType: scheduleForm.scheduleMode,
        dayOfWeek: scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.weekly
          ? Number(scheduleForm.recurringDayOfWeek)
          : null,
        dayOfMonth: (
          scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.monthly
          || scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.yearly
        ) ? Number(scheduleForm.recurringDayOfMonth) : null,
        monthOfYear: scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.yearly
          ? Number(scheduleForm.recurringMonthOfYear)
          : null,
      });
      reloadTasks();
      reloadSchedules();
      setScheduleForm({
        taskMode: 'existing',
        taskId: '',
        newTaskName: '',
        scheduleMode: 'one-time',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        recurringDayOfWeek: '1',
        recurringDayOfMonth: '1',
        recurringMonthOfYear: '0',
      });
      setScheduleStatusMessage('Scheduled event created.');
    } catch (scheduleError) {
      setScheduleStatusMessage(scheduleError.message || 'Failed to create the schedule.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-6 sm:px-6 lg:px-8">

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,_var(--app-secondary)_25%,_transparent)_0%,_transparent_45%)]" />
      <div className="absolute -left-20 top-40 h-48 w-48 rounded-full bg-secondary/15 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-secondary/17 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-border/70 bg-secondary shadow-2xl shadow-primary/10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="relative flex flex-col border-b border-border 
          bg-[linear-gradient(135deg,var(--app-primary)_0%,color-mix(in_oklab,var(--app-primary)_70%,var(--app-accent))_50%,var(--app-accent)_100%)] 
          p-6 text-on-primary lg:border-b-0 lg:border-r lg:border-r-on-primary/10">
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-primary/75">
              Coach Workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {branding.appName}
            </h1>
            <p className="mt-3 text-sm leading-6 text-on-primary/80">
              Signed in as <span className="font-semibold text-on-primary">{coachUser?.email}</span>.
            </p>
          </div>

          <nav className="relative mt-8 flex flex-col gap-3">
            {navItems.map((item) => {
              const isActive = item.id === activeSection;

              return (
                <button
                  key={item.id}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    isActive
                      ? 'border-on-primary/25 bg-on-primary/14 shadow-lg backdrop-blur-sm'
                      : 'border-on-primary/10 bg-on-primary/5 hover:bg-on-primary/10'
                  }`}
                  onClick={() => setActiveSection(item.id)}
                  type="button"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-primary/65">
                    {item.eyebrow}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-on-primary">{item.label}</p>
                  {/* <p className="mt-1 text-sm leading-5 text-on-primary/75">{item.description}</p> */}
                </button>
              );
            })}
          </nav>

          <div className="relative mt-6 flex flex-col gap-3 border-t border-on-primary/10 pt-6 sm:flex-row lg:mt-auto lg:flex-col">
            <Button className="bg-secondary text-primary shadow-none hover:bg-accent/12 focus:ring-on-primary/40 focus:ring-offset-primary" onClick={handleSignOut} type="button">
              Sign out
            </Button>
          </div>

        </aside>

        <section className="flex min-h-full flex-col bg-primary p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 border-b border-border pb-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                {activeNavItem.eyebrow}
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-text">
                {activeNavItem.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-text-muted sm:text-base">
                {activeNavItem.description}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px] xl:min-h-[120px] xl:grid-cols-2">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-secondary px-4 py-4 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Signed in</p>
                <p className="mt-2 text-2xl font-semibold text-text">{homeStats.activeCount}</p>
              </div>
              {/* <div className="rounded-2xl border border-border bg-secondary px-4 py-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Session Types</p>
                <p className="mt-2 text-2xl font-semibold text-text">{homeStats.uniqueSessionTypes}</p>
              </div> */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-secondary px-4 py-4 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Earliest Sign-In</p>
                <p className="mt-2 text-2xl font-semibold text-text">
                  {homeStats.earliestSignIn ? formatSignedInAt(homeStats.earliestSignIn) : 'None'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-5">
            <div className="grid gap-5">
              {activeSection === 'home' ? (
                <article className="rounded-[1.75rem] border border-border bg-secondary p-6 shadow-lg">
                  <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-text">Live team status</p>
                      <p className="mt-2 text-sm leading-6 text-text-muted">
                        Coaches can review active sessions here and end a session directly if a student leaves without signing out.
                      </p>
                    </div>
                  </div>

                  {homeStatusMessage && (
                    <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-text">
                      {homeStatusMessage}
                    </div>
                  )}

                  {activeStudentsError && (
                    <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-text">
                      {activeStudentsError}
                    </div>
                  )}

                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-3">
                      <thead>
                        <tr>
                          <th className="px-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Student</th>
                          <th className="px-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">ID</th>
                          <th className="px-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Signed In</th>
                          <th className="px-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Session Type</th>
                          <th className="px-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingActiveStudents ? (
                          <tr>
                            <td className="rounded-2xl border border-border bg-accent/10 px-4 py-6 text-sm text-text-muted" colSpan={5}>
                              Loading active sessions...
                            </td>
                          </tr>
                        ) : activeStudents.length === 0 ? (
                          <tr>
                            <td className="rounded-2xl border border-border bg-accent/10 px-4 py-6 text-sm text-text-muted" colSpan={5}>
                              No students are currently signed in.
                            </td>
                          </tr>
                        ) : (
                          activeStudents.map((student) => {
                            const sessionType = student[studentAuthConfig.currentTaskField] || 'General session';
                            const isEnding = endingStudentId === student.id;

                            return (
                              <tr key={student.id}>
                                <td className="rounded-l-2xl border-y border-l border-border bg-secondary px-4 py-4 text-sm text-text">
                                  <span className="font-semibold">{student.name ?? 'Student'}</span>
                                </td>
                                <td className="border-y border-border bg-secondary px-4 py-4 text-sm text-text-muted">
                                  {student.studentId ?? 'Not set'}
                                </td>
                                <td className="border-y border-border bg-secondary px-4 py-4 text-sm text-text-muted">
                                  {formatSignedInAt(student[studentAuthConfig.signedInAtField])}
                                </td>
                                <td className="border-y border-border bg-secondary px-4 py-4 text-sm text-text-muted">
                                  {sessionType}
                                </td>
                                <td className="rounded-r-2xl border-y border-r border-border bg-secondary px-4 py-4 text-right">
                                  <button
                                    className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={isEnding}
                                    onClick={() => handleEndSession(student)}
                                    type="button"
                                  >
                                    {isEnding ? 'Ending...' : 'End Session'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
              ) : activeSection === 'schedule' ? (
                <>
                  <article className="rounded-[1.75rem] border border-border bg-secondary p-6 shadow-lg">
                    <div className="border-b border-border pb-5">
                      <p className="text-lg font-semibold text-text">Scheduled task windows</p>
                    </div>

                    {(schedulesError || tasksError) && (
                      <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-text">
                        {schedulesError || tasksError}
                      </div>
                    )}

                    <div className="mt-5 overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-y-3">
                        <thead>
                          <tr>
                            <th className="px-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Task</th>
                            <th className="px-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Type</th>
                            <th className="px-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Start</th>
                            <th className="px-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">End</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(isLoadingSchedules || isLoadingTasks) ? (
                            <tr>
                              <td className="rounded-2xl border border-border bg-accent/10 px-4 py-6 text-sm text-text-muted" colSpan={4}>
                                Loading scheduled events...
                              </td>
                            </tr>
                          ) : upcomingSchedules.length === 0 ? (
                            <tr>
                              <td className="rounded-2xl border border-border bg-accent/10 px-4 py-6 text-sm text-text-muted" colSpan={4}>
                                No upcoming scheduled events found.
                              </td>
                            </tr>
                          ) : (
                            upcomingSchedules.map((schedule) => {
                              const task = tasksById.get(schedule[scheduleConfig.taskIdField]);

                              return (
                                <tr key={schedule.id}>
                                  <td className="rounded-l-2xl border-y border-l border-border bg-secondary px-4 py-4 text-sm text-text">
                                    <span className="font-semibold">
                                      {task?.[taskConfig.nameField] ?? schedule[scheduleConfig.taskIdField] ?? 'Task'}
                                    </span>
                                  </td>
                                  <td className="border-y border-border bg-secondary px-4 py-4 text-sm text-text-muted">
                                    {schedule.displayType}
                                  </td>
                                  <td className="border-y border-border bg-secondary px-4 py-4 text-sm text-text-muted">
                                    {formatScheduleDateTime(schedule.resolvedStartTime)}
                                  </td>
                                  <td className="rounded-r-2xl border-y border-r border-border bg-secondary px-4 py-4 text-sm text-text-muted">
                                    {formatScheduleDateTime(schedule.resolvedEndTime)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="rounded-[1.75rem] border border-border bg-secondary p-6 shadow-lg">
                    <div className="border-b border-border pb-5">
                      <p className="text-lg font-semibold text-text">Add scheduled event</p>
                      <p className="mt-2 text-sm leading-6 text-text-muted">
                        Create a one-time or recurring event and either attach it to an existing task or create a new scheduled task.
                      </p>
                    </div>

                    <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleScheduleSubmit}>
                      <div className="md:col-span-2">
                        <span className="text-sm font-medium text-text">Task source</span>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          {taskSourceOptions.map((option) => {
                            const isActive = scheduleForm.taskMode === option.value;

                            return (
                              <button
                                key={option.value}
                                className={`rounded-[1.5rem] border p-4 text-left transition ${
                                  isActive
                                    ? 'border-accent bg-accent/12 shadow-sm'
                                    : 'border-border bg-secondary hover:bg-accent/10'
                                }`}
                                onClick={() => handleScheduleFieldChange('taskMode', option.value)}
                                type="button"
                              >
                                <p className="text-base font-semibold text-text">{option.title}</p>
                                <p className="mt-2 text-sm leading-6 text-text-muted">{option.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {scheduleForm.taskMode === 'existing' ? (
                        <label className="flex flex-col gap-1.5 md:col-span-2">
                          <span className="text-sm font-medium text-text">Task</span>
                          <select
                            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                            onChange={(e) => handleScheduleFieldChange('taskId', e.target.value)}
                            required
                            value={scheduleForm.taskId}
                          >
                            <option value="">Select a task</option>
                            {tasks.map((task) => (
                              <option key={task.id} value={task.id}>
                                {task[taskConfig.nameField]}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <label className="flex flex-col gap-1.5 md:col-span-2">
                          <span className="text-sm font-medium text-text">New task name</span>
                          <input
                            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                            onChange={(e) => handleScheduleFieldChange('newTaskName', e.target.value)}
                            placeholder="Example: CAD Workshop"
                            required
                            type="text"
                            value={scheduleForm.newTaskName}
                          />
                        </label>
                      )}

                      <div className="md:col-span-2">
                        <span className="text-sm font-medium text-text">Schedule type</span>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          {scheduleTypeOptions.map((option) => {
                            const isActive = scheduleForm.scheduleMode === option.value;

                            return (
                              <button
                                key={option.value}
                                className={`rounded-[1.5rem] border p-4 text-left transition ${
                                  isActive
                                    ? 'border-accent bg-accent/12 shadow-sm'
                                    : 'border-border bg-secondary hover:bg-accent/10'
                                }`}
                                onClick={() => handleScheduleFieldChange('scheduleMode', option.value)}
                                type="button"
                              >
                                <p className="text-base font-semibold text-text">{option.title}</p>
                                <p className="mt-2 text-sm leading-6 text-text-muted">{option.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.weekly && (
                        <label className="flex flex-col gap-1.5 md:col-span-2">
                          <span className="text-sm font-medium text-text">Recurring day</span>
                          <select
                            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                            onChange={(e) => handleScheduleFieldChange('recurringDayOfWeek', e.target.value)}
                            value={scheduleForm.recurringDayOfWeek}
                          >
                            {weekdayOptions.map((weekday) => (
                              <option key={weekday.value} value={weekday.value}>
                                {weekday.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.monthly && (
                        <label className="flex flex-col gap-1.5 md:col-span-2">
                          <span className="text-sm font-medium text-text">Recurring day of month</span>
                          <select
                            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                            onChange={(e) => handleScheduleFieldChange('recurringDayOfMonth', e.target.value)}
                            value={scheduleForm.recurringDayOfMonth}
                          >
                            {dayOfMonthOptions.map((dayOption) => (
                              <option key={dayOption.value} value={dayOption.value}>
                                {dayOption.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.yearly && (
                        <>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-text">Recurring month</span>
                            <select
                              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                              onChange={(e) => handleScheduleFieldChange('recurringMonthOfYear', e.target.value)}
                              value={scheduleForm.recurringMonthOfYear}
                            >
                              {monthOptions.map((monthOption) => (
                                <option key={monthOption.value} value={monthOption.value}>
                                  {monthOption.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-text">Recurring day of month</span>
                            <select
                              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                              onChange={(e) => handleScheduleFieldChange('recurringDayOfMonth', e.target.value)}
                              value={scheduleForm.recurringDayOfMonth}
                            >
                              {dayOfMonthOptions.map((dayOption) => (
                                <option key={dayOption.value} value={dayOption.value}>
                                  {dayOption.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      )}

                      {scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.oneTime ? (
                        <>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-text">Start date</span>
                            <input
                              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                              onChange={(e) => handleScheduleFieldChange('startDate', e.target.value)}
                              required
                              type="date"
                              value={scheduleForm.startDate}
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-text">Start time</span>
                            <input
                              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                              onChange={(e) => handleScheduleFieldChange('startTime', e.target.value)}
                              required
                              type="time"
                              value={scheduleForm.startTime}
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-text">End date</span>
                            <input
                              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                              onChange={(e) => handleScheduleFieldChange('endDate', e.target.value)}
                              required
                              type="date"
                              value={scheduleForm.endDate}
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-text">End time</span>
                            <input
                              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                              onChange={(e) => handleScheduleFieldChange('endTime', e.target.value)}
                              required
                              type="time"
                              value={scheduleForm.endTime}
                            />
                          </label>
                        </>
                      ) : (
                        <>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-text">Start time</span>
                            <input
                              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                              onChange={(e) => handleScheduleFieldChange('startTime', e.target.value)}
                              required
                              type="time"
                              value={scheduleForm.startTime}
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-text">End time</span>
                            <input
                              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                              onChange={(e) => handleScheduleFieldChange('endTime', e.target.value)}
                              required
                              type="time"
                              value={scheduleForm.endTime}
                            />
                          </label>
                        </>
                      )}

                      <div className="md:col-span-2">
                        <Button className="md:w-auto" disabled={isSavingSchedule || isLoadingTasks} type="submit">
                          {isSavingSchedule ? 'Saving event...' : 'Add Event'}
                        </Button>
                      </div>
                    </form>

                    {scheduleStatusMessage && (
                      <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-text">
                        {scheduleStatusMessage}
                      </div>
                    )}
                  </article>
                </>
              ) : (
                sectionCards.map((card) => (
                  <article
                    key={card.title}
                    className="rounded-[1.75rem] border border-border bg-secondary p-6 shadow-lg"
                  >
                    <p className="text-lg font-semibold text-text">{card.title}</p>
                    <p className="mt-3 text-sm leading-7 text-text-muted">{card.body}</p>
                  </article>
                ))
              )}
            </div>

          </div>
        </section>
      </div>
    </main>
  );
};

export default CoachDashboard;
