import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AnalyticsDashboard from '../components/dashboard/AnalyticsDashboard';
import StudentManagementDashboard from '../components/dashboard/StudentManagementDashboard';
import TaskAvailabilityCard from '../components/dashboard/TaskAvailabilityCard';
import Button from '../components/shared/Button';
import Calendar from '../components/shared/Calendar';
import Dropdown from '../components/shared/Dropdown';
import { branding } from '../config/branding';
import { scheduleConfig, studentAuthConfig, taskConfig } from '../config/appConfig';
import { ROUTES } from '../config/routesConfig';
import { useAuth } from '../features/auth/useAuth.jsx';
import { useSchedules } from '../features/schedules/useSchedules';
import {
  createSchedule,
  deleteSchedule,
  excludeScheduleOccurrence,
} from '../features/schedules/scheduleService';
import { useActiveStudents, useStudents } from '../features/students/useStudents';
import { useTasks } from '../features/tasks/useTasks';
import { createTask } from '../features/tasks/taskService';
import {
  endStaleStudentSession,
  endStudentSessionByCoach,
} from '../features/timeLogs/timeLogService';
import {
  formatSignedInAt,
  toDate,
} from '../lib/dateUtils';
import { MISSING_VALUE_LABEL } from '../lib/constants';
import { isCurrentMember } from '../lib/studentUtils';
import {
  DASHBOARD_CARD_CLASS_NAME,
  FORM_INPUT_CLASS_NAME,
} from '../styles/classNames';

const navItems = [
  {
    id: 'home',
    label: 'Home',
    eyebrow: 'Overview',
    title: 'Coach home base',
    description: 'Track live session status',
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
  {
    id: 'student management',
    label: 'Students',
    eyebrow: 'Team',
    title: 'Student management',
    description: 'Add students, manage roster status, and update student details.',
  }
];

const getSectionSlug = (sectionId) => sectionId.replace(/\s+/g, '-');

const getSectionFromSlug = (sectionSlug) => (
  navItems.find((item) => getSectionSlug(item.id) === sectionSlug)?.id ?? 'home'
);

const getSectionScrollStorageKey = (sectionId) => (
  `coach-dashboard-scroll:${getSectionSlug(sectionId)}`
);

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

const meetingCountingOptions = [
  {
    value: 'attendance',
    title: 'Counts for attendance',
  },
  {
    value: 'optional',
    title: 'Does not count',
  },
  {
    value: 'outreach',
    title: 'Counts for outreach',
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

// This page coordinates the coach sections and their shared Firestore data.
// Larger student-management and analytics sections live in separate components
// so this file can focus on navigation, live sessions, and scheduling.
const CoachDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = getSectionFromSlug(searchParams.get('section'));
  const [visitedSections, setVisitedSections] = useState(() => new Set([activeSection]));
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
    meetingCountingType: 'attendance',
  });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleStatusMessage, setScheduleStatusMessage] = useState('');
  const [autoCheckoutTick, setAutoCheckoutTick] = useState(0);
  const autoCheckoutStudentIdsRef = useRef(new Set());
  const { coachUser, signOutCoach } = useAuth();
  const navigate = useNavigate();
  const hasVisitedHome = visitedSections.has('home') || activeSection === 'home';
  const hasVisitedSchedule = visitedSections.has('schedule') || activeSection === 'schedule';
  const hasVisitedAnalytics = visitedSections.has('analytics') || activeSection === 'analytics';
  const hasVisitedStudentManagement = (
    visitedSections.has('student management')
    || activeSection === 'student management'
  );
  const shouldLoadStudents = hasVisitedHome || hasVisitedAnalytics || hasVisitedStudentManagement;
  const shouldLoadActiveStudents = !shouldLoadStudents;
  const shouldLoadTasks = hasVisitedSchedule || hasVisitedStudentManagement;
  const {
    students: subscribedActiveStudents,
    isLoading: isLoadingSubscribedActiveStudents,
    error: subscribedActiveStudentsError,
  } = useActiveStudents({ enabled: shouldLoadActiveStudents });
  const { students, isLoading: isLoadingStudents, error: studentsError } = useStudents({
    enabled: shouldLoadStudents,
  });
  const activeStudentsFromRoster = useMemo(
    () => students
      .filter((student) => (
        student[studentAuthConfig.signedInField] === true
        && isCurrentMember(student)
      ))
      .sort((left, right) => {
        const leftTime = toDate(left[studentAuthConfig.signedInAtField])?.getTime() ?? 0;
        const rightTime = toDate(right[studentAuthConfig.signedInAtField])?.getTime() ?? 0;

        return leftTime - rightTime;
      }),
    [students],
  );
  const activeStudents = shouldLoadStudents
    ? activeStudentsFromRoster
    : subscribedActiveStudents;
  const isLoadingActiveStudents = shouldLoadStudents
    ? isLoadingStudents
    : isLoadingSubscribedActiveStudents;
  const activeStudentsError = shouldLoadStudents
    ? studentsError
    : subscribedActiveStudentsError;
  const shouldLoadSchedules = (
    hasVisitedSchedule
    || hasVisitedAnalytics
    || hasVisitedStudentManagement
    || activeStudents.length > 0
  );
  const { tasks, isLoading: isLoadingTasks, error: tasksError, reloadTasks } = useTasks({
    enabled: shouldLoadTasks,
  });
  const { schedules, isLoading: isLoadingSchedules, error: schedulesError, reloadSchedules } = useSchedules(
    undefined,
    { enabled: shouldLoadSchedules },
  );

  const activeNavItem = useMemo(
    () => navItems.find((item) => item.id === activeSection) ?? navItems[0],
    [activeSection],
  );

  useEffect(() => {
    setVisitedSections((currentSections) => {
      if (currentSections.has(activeSection)) {
        return currentSections;
      }

      const nextSections = new Set(currentSections);
      nextSections.add(activeSection);
      return nextSections;
    });
  }, [activeSection]);

  useEffect(() => {
    // Each dashboard section remembers its own scroll position for this tab.
    // Two animation frames give React time to render the new section first.
    const storageKey = getSectionScrollStorageKey(activeSection);
    const savedScrollPosition = Number(sessionStorage.getItem(storageKey));
    let secondAnimationFrame = 0;
    const firstAnimationFrame = window.requestAnimationFrame(() => {
      secondAnimationFrame = window.requestAnimationFrame(() => {
        window.scrollTo({
          behavior: 'auto',
          top: Number.isFinite(savedScrollPosition) ? savedScrollPosition : 0,
        });
      });
    });

    const saveScrollPosition = () => {
      sessionStorage.setItem(storageKey, String(window.scrollY));
    };

    window.addEventListener('scroll', saveScrollPosition, { passive: true });

    return () => {
      window.cancelAnimationFrame(firstAnimationFrame);
      window.cancelAnimationFrame(secondAnimationFrame);
      saveScrollPosition();
      window.removeEventListener('scroll', saveScrollPosition);
    };
  }, [activeSection]);

  useEffect(() => {
    // Trigger the stale-session check just after each midnight, even when the
    // dashboard remains open overnight.
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 1, 0);
    const timeoutId = window.setTimeout(() => {
      setAutoCheckoutTick((currentValue) => currentValue + 1);
    }, nextMidnight.getTime() - now.getTime());

    return () => window.clearTimeout(timeoutId);
  }, [autoCheckoutTick]);

  useEffect(() => {
    if (isLoadingActiveStudents || isLoadingSchedules) {
      return;
    }

    // The ref prevents duplicate checkout requests while a student's first
    // request is still in progress.
    activeStudents.forEach((student) => {
      if (autoCheckoutStudentIdsRef.current.has(student.id)) {
        return;
      }

      autoCheckoutStudentIdsRef.current.add(student.id);

      endStaleStudentSession({
        schedules,
        student,
      }).catch((autoCheckoutError) => {
        setHomeStatusMessage(
          autoCheckoutError.message || 'Failed to automatically close a stale student session.',
        );
      }).finally(() => {
        autoCheckoutStudentIdsRef.current.delete(student.id);
      });
    });
  }, [
    activeStudents,
    autoCheckoutTick,
    isLoadingActiveStudents,
    isLoadingSchedules,
    schedules,
  ]);

  const signedOutStudents = useMemo(
    () => students
      .filter((student) => (
        student[studentAuthConfig.signedInField] !== true
        && isCurrentMember(student)
      ))
      .sort((left, right) => (
        String(left.name ?? '').localeCompare(String(right.name ?? ''))
        || String(left[studentAuthConfig.idField] ?? '').localeCompare(
          String(right[studentAuthConfig.idField] ?? ''),
        )
      )),
    [students],
  );

  const homeStats = useMemo(() => {
    const activeCount = activeStudents.length;

    return {
      activeCount,
      earliestSignIn: activeStudents[0]?.[studentAuthConfig.signedInAtField] ?? null,
    };
  }, [activeStudents]);

  const handleSignOut = async () => {
    await signOutCoach();
    navigate(ROUTES.accessPortal, { replace: true });
  };

  const handleSectionChange = (sectionId) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    nextSearchParams.set('section', getSectionSlug(sectionId));
    setSearchParams(nextSearchParams);
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
    // Recurring schedules need only a time-of-day template. One-time schedules
    // use the exact dates entered by the coach.
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
        countsForAttendance: scheduleForm.meetingCountingType === 'attendance',
        countsForOutreach: scheduleForm.meetingCountingType === 'outreach',
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
        meetingCountingType: 'attendance',
      });
      setScheduleStatusMessage('Scheduled event created.');
    } catch (scheduleError) {
      setScheduleStatusMessage(scheduleError.message || 'Failed to create the schedule.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleRemoveScheduleOccurrence = async ({
    occurrenceDate,
    schedule,
  }) => {
    await excludeScheduleOccurrence({
      occurrenceDate,
      scheduleId: schedule.id,
    });
    reloadSchedules();
  };

  const handleRemoveSchedule = async (schedule) => {
    await deleteSchedule(schedule.id);
    reloadSchedules();
  };

  return (
    <main className="relative min-h-screen overflow-x-clip bg-background px-4 py-6 sm:px-6 lg:px-8">

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,_var(--app-secondary)_25%,_transparent)_0%,_transparent_45%)]" />
      <div className="absolute -left-20 top-40 h-48 w-48 rounded-full bg-secondary/15 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-secondary/17 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-border/70 bg-secondary shadow-2xl shadow-primary/10 lg:grid-cols-[290px_minmax(0,1fr)] lg:overflow-visible">
        <aside className="relative flex flex-col border-b border-border
          bg-[linear-gradient(135deg,var(--app-primary)_0%,color-mix(in_oklab,var(--app-primary)_70%,var(--app-accent))_50%,var(--app-accent)_100%)]
          p-6 text-on-primary lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:rounded-l-[2rem] lg:border-b-0 lg:border-r lg:border-r-on-primary/10">
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-primary/90">
              Coach Dashboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {branding.appName}
            </h1>
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
                  onClick={() => handleSectionChange(item.id)}
                  type="button"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-primary/90">
                    {item.eyebrow}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-on-primary">{item.label}</p>
                </button>
              );
            })}
          </nav>

          <div className="relative mt-6 flex flex-col gap-3 border-t border-on-primary/10 pt-6 sm:flex-row lg:mt-auto lg:flex-col">
            <Button className="bg-secondary text-on-secondary shadow-none hover:bg-accent/12 focus:ring-on-primary/40 focus:ring-offset-primary" onClick={handleSignOut} type="button">
              Sign out
            </Button>
          </div>

        </aside>

        <section className="flex min-h-full flex-col bg-primary p-6 sm:p-8 lg:rounded-r-[2rem] lg:p-10">
          <div className="flex flex-col gap-6 border-b border-border pb-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">
                {activeNavItem.eyebrow}
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-on-primary">
                {activeNavItem.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-on-primary/90 sm:text-base">
                {activeNavItem.description}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px] xl:min-h-[120px] xl:grid-cols-2">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-transparent px-4 py-4 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-primary">Signed in</p>
                <p className="mt-2 text-2xl font-semibold text-on-primary">{homeStats.activeCount}</p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-transparent px-4 py-4 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-primary">Earliest Sign-In</p>
                <p className="mt-2 text-2xl font-semibold text-on-primary">
                  {homeStats.earliestSignIn ? formatSignedInAt(homeStats.earliestSignIn) : 'None'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-5">
            <div className="grid gap-5">
              {activeSection === 'home' ? (
                <>
                  <article className={DASHBOARD_CARD_CLASS_NAME}>
                    <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-on-primary">Live team status</p>
                        <p className="mt-2 leading-6 text-on-primary/90">
                          Coaches can review active sessions here and end a session directly if a student leaves without signing out.
                        </p>
                      </div>
                    </div>

                    {homeStatusMessage && (
                      <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
                        {homeStatusMessage}
                      </div>
                    )}

                    {activeStudentsError && (
                      <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
                        {activeStudentsError}
                      </div>
                    )}

                    <div className="mt-5 overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-y-3">
                        <thead>
                          <tr>
                            <th className="px-4 text-left text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">Student</th>
                            <th className="px-4 text-left text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">ID</th>
                            <th className="px-4 text-left text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">Signed In</th>
                            <th className="px-4 text-left text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">Session Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {isLoadingActiveStudents ? (
                            <tr>
                              <td className="rounded-2xl border border-border bg-accent/10 px-4 py-6 text-on-primary/90" colSpan={5}>
                                Loading active sessions...
                              </td>
                            </tr>
                          ) : activeStudents.length === 0 ? (
                            <tr>
                              <td className="rounded-2xl border border-border bg-accent/10 px-4 py-6 text-on-primary/90" colSpan={5}>
                                No students are currently signed in.
                              </td>
                            </tr>
                          ) : (
                            activeStudents.map((student) => {
                              const sessionType = student[studentAuthConfig.currentTaskField] || 'General session';
                              const isEnding = endingStudentId === student.id;

                              return (
                                <tr key={student.id}>
                                  <td className="rounded-l-2xl border-y border-l border-border bg-transparent px-4 py-4 text-on-primary">
                                    <span className="font-semibold">{student.name ?? 'Student'}</span>
                                  </td>
                                  <td className="border-y border-border bg-transparent px-4 py-4  text-on-primary">
                                    {student.studentId ?? MISSING_VALUE_LABEL}
                                  </td>
                                  <td className="border-y border-border bg-transparent px-4 py-4 text-on-primary">
                                    {formatSignedInAt(student[studentAuthConfig.signedInAtField])}
                                  </td>
                                  <td className="border-y border-border bg-transparent px-4 py-4 text-on-primary">
                                    {sessionType}
                                  </td>
                                  <td className="rounded-r-2xl border-y border-r border-border bg-transparent px-4 py-4 text-right">
                                    <button
                                      className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-on-secondary bg-secondary transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
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

                  <article className={DASHBOARD_CARD_CLASS_NAME}>
                    <div className="border-b border-border pb-5">
                      <p className="text-lg font-semibold text-on-primary">Students not signed in</p>
                      <p className="mt-2 leading-6 text-on-primary/90">
                        Current team members who do not have an active session.
                      </p>
                    </div>

                    {studentsError && (
                      <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
                        {studentsError}
                      </div>
                    )}

                    <div className="mt-5 overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-y-3">
                        <thead>
                          <tr>
                            <th className="px-4 text-left text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">Student</th>
                            <th className="px-4 text-left text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">ID</th>
                            <th className="px-4 text-left text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {isLoadingStudents ? (
                            <tr>
                              <td className="rounded-2xl border border-border bg-accent/10 px-4 py-6 text-on-primary/90" colSpan={3}>
                                Loading signed-out students...
                              </td>
                            </tr>
                          ) : signedOutStudents.length === 0 ? (
                            <tr>
                              <td className="rounded-2xl border border-border bg-accent/10 px-4 py-6 text-on-primary/90" colSpan={3}>
                                All current students are signed in.
                              </td>
                            </tr>
                          ) : (
                            signedOutStudents.map((student) => (
                              <tr key={student.id}>
                                <td className="rounded-l-2xl border-y border-l border-border bg-transparent px-4 py-4 text-on-primary">
                                  <span className="font-semibold">{student.name ?? 'Student'}</span>
                                </td>
                                <td className="border-y border-border bg-transparent px-4 py-4 text-on-primary">
                                  {student[studentAuthConfig.idField] ?? MISSING_VALUE_LABEL}
                                </td>
                                <td className="rounded-r-2xl border-y border-r border-border bg-transparent px-4 py-4 text-on-primary">
                                  Not signed in
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </article>
                </>
              ) : activeSection === 'schedule' ? (
                <>
                  <Calendar
                    canManage
                    className={DASHBOARD_CARD_CLASS_NAME}
                    error={schedulesError || tasksError}
                    isLoading={isLoadingSchedules || isLoadingTasks}
                    onRemoveOccurrence={handleRemoveScheduleOccurrence}
                    onRemoveSchedule={handleRemoveSchedule}
                    schedules={schedules}
                    tasks={tasks}
                  />

                  <TaskAvailabilityCard
                    cardClassName={DASHBOARD_CARD_CLASS_NAME}
                    error={tasksError}
                    isLoading={isLoadingTasks}
                    onTasksChanged={reloadTasks}
                    tasks={tasks}
                  />

                  <article className={DASHBOARD_CARD_CLASS_NAME}>
                    <div className="border-b border-border pb-5">
                      <p className="text-lg font-semibold text-on-primary">Add scheduled event</p>
                      <p className="mt-2 leading-6 text-on-primary/90">
                        Create a one-time or recurring event and either attach it to an existing task or create a new scheduled task.
                      </p>
                    </div>

                    <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleScheduleSubmit}>
                      <div className="md:col-span-2">
                        <span className="text-sm font-medium text-on-primary">Task source</span>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          {taskSourceOptions.map((option) => {
                            const isActive = scheduleForm.taskMode === option.value;

                            return (
                              <button
                                key={option.value}
                                className={`rounded-[1.5rem] border p-4 text-left transition ${
                                  isActive
                                    ? 'border-accent bg-accent/12 shadow-sm text-on-primary'
                                    : 'border-border bg-secondary hover:bg-accent/10'
                                }`}
                                onClick={() => handleScheduleFieldChange('taskMode', option.value)}
                                type="button"
                              >
                                <p className={`text-base font-semibold ${isActive ? 'text-on-primary' : 'text-on-secondary'}`}>{option.title}</p>
                                <p className={`mt-2 text-sm leading-6 ${isActive ? 'text-on-primary/90' : 'text-on-secondary/90'}`}>{option.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {scheduleForm.taskMode === 'existing' ? (
                        <Dropdown
                          className="md:col-span-2 text-on-secondary"
                          label="Task"
                          onChange={(value) => handleScheduleFieldChange('taskId', value)}
                          options={tasks.map((task) => ({
                            label: task[taskConfig.nameField],
                            value: task.id,
                          }))}
                          placeholder="Select a task"
                          value={scheduleForm.taskId}
                        />
                      ) : (
                        <label className="flex flex-col gap-1.5 md:col-span-2">
                          <span className="text-sm font-medium text-on-primary">New task name</span>
                          <input
                            className={FORM_INPUT_CLASS_NAME}
                            onChange={(e) => handleScheduleFieldChange('newTaskName', e.target.value)}
                            placeholder="Example: CAD Workshop"
                            required
                            type="text"
                            value={scheduleForm.newTaskName}
                          />
                        </label>
                      )}

                      <div className="md:col-span-2">
                        <span className="text-sm font-medium text-on-primary">Schedule type</span>
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
                                <p className={`text-base font-semibold ${isActive ? 'text-on-primary' : 'text-on-secondary'}`}>{option.title}</p>
                                <p className={`mt-2 text-sm leading-6 ${isActive ? 'text-on-primary/90' : 'text-on-secondary/90'}`}>{option.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <span className="text-sm font-medium text-on-primary">Meeting hours type</span>
                        <div className="mt-2 grid gap-3 md:grid-cols-3">
                          {meetingCountingOptions.map((option) => {
                            const isActive = scheduleForm.meetingCountingType === option.value;

                            return (
                              <button
                                key={option.value}
                                aria-pressed={isActive}
                                className={`rounded-[1.5rem] border p-4 text-left transition ${
                                  isActive
                                    ? 'border-accent bg-accent/12 shadow-sm'
                                    : 'border-border bg-secondary hover:bg-accent/10'
                                }`}
                                onClick={() => handleScheduleFieldChange('meetingCountingType', option.value)}
                                type="button"
                              >
                                <p className={`text-base font-semibold ${isActive ? 'text-on-primary' : 'text-on-secondary'}`}>{option.title}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.weekly && (
                        <Dropdown
                          className="md:col-span-2"
                          label="Recurring day"
                          onChange={(value) => handleScheduleFieldChange('recurringDayOfWeek', value)}
                          options={weekdayOptions}
                          value={scheduleForm.recurringDayOfWeek}
                        />
                      )}

                      {scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.monthly && (
                        <Dropdown
                          className="md:col-span-2"
                          label="Recurring day of month"
                          onChange={(value) => handleScheduleFieldChange('recurringDayOfMonth', value)}
                          options={dayOfMonthOptions}
                          value={scheduleForm.recurringDayOfMonth}
                        />
                      )}

                      {scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.yearly && (
                        <>
                          <Dropdown
                            label="Recurring month"
                            onChange={(value) => handleScheduleFieldChange('recurringMonthOfYear', value)}
                            options={monthOptions}
                            value={scheduleForm.recurringMonthOfYear}
                          />

                          <Dropdown
                            label="Recurring day of month"
                            onChange={(value) => handleScheduleFieldChange('recurringDayOfMonth', value)}
                            options={dayOfMonthOptions}
                            value={scheduleForm.recurringDayOfMonth}
                          />
                        </>
                      )}

                      {scheduleForm.scheduleMode === scheduleConfig.recurrenceTypes.oneTime ? (
                        <>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-on-primary">Start date</span>
                            <input
                              className={FORM_INPUT_CLASS_NAME}
                              onChange={(e) => handleScheduleFieldChange('startDate', e.target.value)}
                              required
                              type="date"
                              value={scheduleForm.startDate}
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-on-primary">Start time</span>
                            <input
                              className={FORM_INPUT_CLASS_NAME}
                              onChange={(e) => handleScheduleFieldChange('startTime', e.target.value)}
                              required
                              type="time"
                              value={scheduleForm.startTime}
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-on-primary">End date</span>
                            <input
                              className={FORM_INPUT_CLASS_NAME}
                              onChange={(e) => handleScheduleFieldChange('endDate', e.target.value)}
                              required
                              type="date"
                              value={scheduleForm.endDate}
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-on-primary">End time</span>
                            <input
                              className={FORM_INPUT_CLASS_NAME}
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
                            <span className="text-sm font-medium text-on-primary">Start time</span>
                            <input
                              className={FORM_INPUT_CLASS_NAME}
                              onChange={(e) => handleScheduleFieldChange('startTime', e.target.value)}
                              required
                              type="time"
                              value={scheduleForm.startTime}
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-on-primary">End time</span>
                            <input
                              className={FORM_INPUT_CLASS_NAME}
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
                      <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
                        {scheduleStatusMessage}
                      </div>
                    )}
                  </article>
                </>
              ) : null}

              {hasVisitedAnalytics && (
                <div className={activeSection === 'analytics' ? 'block' : 'hidden'}>
                  <AnalyticsDashboard
                    cardClassName={DASHBOARD_CARD_CLASS_NAME}
                    isLoadingSchedules={isLoadingSchedules}
                    isLoadingStudents={isLoadingStudents}
                    schedules={schedules}
                    schedulesError={schedulesError}
                    students={students}
                    studentsError={studentsError}
                  />
                </div>
              )}

              {hasVisitedStudentManagement && (
                <div className={activeSection === 'student management' ? 'block' : 'hidden'}>
                  <StudentManagementDashboard
                    cardClassName={DASHBOARD_CARD_CLASS_NAME}
                    isLoadingSchedules={isLoadingSchedules}
                    isLoadingStudents={isLoadingStudents}
                    isLoadingTasks={isLoadingTasks}
                    schedules={schedules}
                    schedulesError={schedulesError}
                    students={students}
                    studentsError={studentsError}
                    tasks={tasks}
                    tasksError={tasksError}
                  />
                </div>
              )}
            </div>

          </div>
        </section>
      </div>
    </main>
  );
};

export default CoachDashboard;

