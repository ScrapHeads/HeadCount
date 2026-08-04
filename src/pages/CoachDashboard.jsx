import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AnalyticsDashboard from '../components/dashboard/AnalyticsDashboard';
import ScheduleEventForm from '../components/dashboard/ScheduleEventForm';
import StudentManagementDashboard from '../components/dashboard/StudentManagementDashboard';
import TaskAvailabilityCard from '../components/dashboard/TaskAvailabilityCard';
import Button from '../components/shared/Button';
import Calendar from '../components/shared/Calendar';
import { branding } from '../config/branding';
import { scheduleConfig, studentAuthConfig, taskConfig } from '../config/appConfig';
import { ROUTES } from '../config/routesConfig';
import { useAuth } from '../features/auth/useAuth.jsx';
import { useSchedules } from '../features/schedules/useSchedules';
import {
  createSchedule,
  deleteSchedule,
  excludeScheduleOccurrence,
  updateSchedule,
} from '../features/schedules/scheduleService';
import { getScheduleRecurrenceType } from '../features/schedules/scheduleUtils';
import { useActiveStudents, useStudents } from '../features/students/useStudents';
import { useTasks } from '../features/tasks/useTasks';
import { createTask } from '../features/tasks/taskService';
import { taskMatchesReference } from '../features/tasks/taskUtils';
import {
  endStaleStudentSession,
  endStudentSessionByCoach,
} from '../features/timeLogs/timeLogService';
import {
  formatSignedInAt,
  shiftDateInputValue,
  toDate,
  toDateInputValue,
} from '../lib/dateUtils';
import { MISSING_VALUE_LABEL } from '../lib/constants';
import { isCurrentMember } from '../lib/studentUtils';
import { DASHBOARD_CARD_CLASS_NAME } from '../styles/classNames';

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

const getEmptyScheduleForm = () => ({
  taskMode: 'existing',
  taskId: '',
  newTaskName: '',
  scheduleMode: scheduleConfig.recurrenceTypes.oneTime,
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  recurringStartDate: '',
  recurringEndDate: '',
  recurringDayOfWeek: '1',
  recurringDayOfMonth: '1',
  recurringMonthOfYear: '0',
  meetingCountingType: 'attendance',
  noteRequirement: scheduleConfig.noteRequirements.both,
});

const toTimeInputValue = (date) => (
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
);

const getScheduleFormForOccurrence = (occurrence, tasks, useSeriesRecurrence = false) => {
  const { schedule } = occurrence;
  const scheduleTaskReference = schedule[scheduleConfig.taskIdField] ?? '';
  const matchingTask = tasks.find((task) => taskMatchesReference(task, scheduleTaskReference));
  const meetingCountingType = schedule[scheduleConfig.countsForOutreachField]
    ? 'outreach'
    : schedule[scheduleConfig.countsForAttendanceField] === false
      ? 'optional'
      : 'attendance';

  return {
    ...getEmptyScheduleForm(),
    taskId: matchingTask?.id ?? scheduleTaskReference,
    scheduleMode: useSeriesRecurrence
      ? getScheduleRecurrenceType(schedule)
      : scheduleConfig.recurrenceTypes.oneTime,
    startDate: toDateInputValue(occurrence.startTime),
    startTime: toTimeInputValue(occurrence.startTime),
    endDate: toDateInputValue(occurrence.endTime),
    endTime: toTimeInputValue(occurrence.endTime),
    recurringStartDate: occurrence.dateKey,
    recurringEndDate: schedule[scheduleConfig.recurrenceEndsBeforeField]
      ? shiftDateInputValue(schedule[scheduleConfig.recurrenceEndsBeforeField], -1)
      : '',
    recurringDayOfWeek: String(schedule[scheduleConfig.dayOfWeekField] ?? occurrence.startTime.getDay()),
    recurringDayOfMonth: String(schedule[scheduleConfig.dayOfMonthField] ?? occurrence.startTime.getDate()),
    recurringMonthOfYear: String(schedule[scheduleConfig.monthOfYearField] ?? occurrence.startTime.getMonth()),
    meetingCountingType,
    noteRequirement: schedule[scheduleConfig.noteRequirementField]
      ?? scheduleConfig.noteRequirements.both,
  };
};

const getScheduleInput = (form, taskId) => {
  const isRecurring = form.scheduleMode !== scheduleConfig.recurrenceTypes.oneTime;

  return {
    taskId,
    startTime: isRecurring
      ? buildRecurringDateTime(form.startTime)
      : buildDateTimeFromForm(form.startDate, form.startTime),
    endTime: isRecurring
      ? buildRecurringDateTime(form.endTime)
      : buildDateTimeFromForm(form.endDate, form.endTime),
    isRecurring,
    recurrenceStartsOn: isRecurring ? form.recurringStartDate : null,
    recurrenceEndsOn: isRecurring ? form.recurringEndDate : null,
    recurrenceType: form.scheduleMode,
    dayOfWeek: form.scheduleMode === scheduleConfig.recurrenceTypes.weekly
      ? Number(form.recurringDayOfWeek)
      : null,
    dayOfMonth: (
      form.scheduleMode === scheduleConfig.recurrenceTypes.monthly
      || form.scheduleMode === scheduleConfig.recurrenceTypes.yearly
    ) ? Number(form.recurringDayOfMonth) : null,
    monthOfYear: form.scheduleMode === scheduleConfig.recurrenceTypes.yearly
      ? Number(form.recurringMonthOfYear)
      : null,
    countsForAttendance: form.meetingCountingType === 'attendance',
    countsForOutreach: form.meetingCountingType === 'outreach',
    noteRequirement: form.noteRequirement,
  };
};

const hasIncompleteScheduleInput = (scheduleInput) => (
  !scheduleInput.startTime
  || !scheduleInput.endTime
  || (
    scheduleInput.isRecurring
    && (!scheduleInput.recurrenceStartsOn || !scheduleInput.recurrenceEndsOn)
  )
);

// This page coordinates the coach sections and their shared Firestore data.
// Larger student-management and analytics sections live in separate components
// so this file can focus on navigation, live sessions, and scheduling.
const CoachDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = getSectionFromSlug(searchParams.get('section'));
  const [visitedSections, setVisitedSections] = useState(() => new Set([activeSection]));
  const [endingStudentId, setEndingStudentId] = useState('');
  const [homeStatusMessage, setHomeStatusMessage] = useState('');
  const [scheduleForm, setScheduleForm] = useState(getEmptyScheduleForm);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleStatusMessage, setScheduleStatusMessage] = useState('');
  const [editingOccurrence, setEditingOccurrence] = useState(null);
  const [editScheduleForm, setEditScheduleForm] = useState(getEmptyScheduleForm);
  const [editScope, setEditScope] = useState('occurrence');
  const [editStatusMessage, setEditStatusMessage] = useState('');
  const [isSavingScheduleEdit, setIsSavingScheduleEdit] = useState(false);
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

    const scheduleInput = getScheduleInput(scheduleForm, scheduleForm.taskId);
    const useNewTask = scheduleForm.taskMode === 'new';

    if (
      (!useNewTask && !scheduleForm.taskId)
      || (useNewTask && !scheduleForm.newTaskName.trim())
      || hasIncompleteScheduleInput(scheduleInput)
    ) {
      setScheduleStatusMessage('Task details, dates, and times are required.');
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

      await createSchedule(getScheduleInput(scheduleForm, taskId));
      reloadTasks();
      reloadSchedules();
      setScheduleForm(getEmptyScheduleForm());
      setScheduleStatusMessage('Scheduled event created.');
    } catch (scheduleError) {
      setScheduleStatusMessage(scheduleError.message || 'Failed to create the schedule.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleOpenScheduleEdit = (occurrence) => {
    setEditingOccurrence(occurrence);
    setEditScope(occurrence.isRecurring ? 'occurrence' : 'event');
    setEditScheduleForm(getScheduleFormForOccurrence(occurrence, tasks));
    setEditStatusMessage('');
  };

  const handleEditScheduleFieldChange = (field, value) => {
    setEditScheduleForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
    setEditStatusMessage('');
  };

  const handleEditScopeChange = (nextScope) => {
    setEditScope(nextScope);
    setEditScheduleForm((currentValue) => ({
      ...currentValue,
      scheduleMode: nextScope === 'occurrence'
        ? scheduleConfig.recurrenceTypes.oneTime
        : getScheduleRecurrenceType(editingOccurrence.schedule),
    }));
    setEditStatusMessage('');
  };

  const handleScheduleEditSubmit = async (event) => {
    event.preventDefault();

    const scheduleInput = getScheduleInput(editScheduleForm, editScheduleForm.taskId);
    const useNewTask = editScheduleForm.taskMode === 'new';

    if (
      (!useNewTask && !editScheduleForm.taskId)
      || (useNewTask && !editScheduleForm.newTaskName.trim())
      || hasIncompleteScheduleInput(scheduleInput)
    ) {
      setEditStatusMessage('Task details, dates, and times are required.');
      return;
    }

    setIsSavingScheduleEdit(true);
    setEditStatusMessage('');

    try {
      let taskId = editScheduleForm.taskId;

      if (useNewTask) {
        const createdTask = await createTask({
          name: editScheduleForm.newTaskName,
          scheduled: true,
        });
        taskId = createdTask.id;
      }

      await updateSchedule({
        ...getScheduleInput(editScheduleForm, taskId),
        occurrenceDate: editingOccurrence.dateKey,
        schedule: editingOccurrence.schedule,
        updateScope: editScope,
      });
      reloadTasks();
      reloadSchedules();
      setEditingOccurrence(null);
    } catch (scheduleError) {
      setEditStatusMessage(scheduleError.message || 'Failed to update the scheduled event.');
    } finally {
      setIsSavingScheduleEdit(false);
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
                    onModifyOccurrence={handleOpenScheduleEdit}
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

                    <ScheduleEventForm
                      form={scheduleForm}
                      isLoadingTasks={isLoadingTasks}
                      isSaving={isSavingSchedule}
                      onFieldChange={handleScheduleFieldChange}
                      onSubmit={handleScheduleSubmit}
                      submitLabel="Add Event"
                      tasks={tasks}
                    />

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

      {editingOccurrence && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/75 px-4 py-8 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingScheduleEdit) {
              setEditingOccurrence(null);
            }
          }}
        >
          <section
            aria-labelledby="modify-schedule-title"
            aria-modal="true"
            className="w-full max-w-4xl rounded-[2rem] border border-border bg-primary p-6 shadow-2xl sm:p-8"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <h2 className="text-2xl font-semibold text-on-primary" id="modify-schedule-title">
                  Modify scheduled event
                </h2>
                <p className="mt-2 text-sm leading-6 text-on-primary/85">
                  Update the event using the same schedule settings as the add-event form.
                </p>
              </div>
              <button
                aria-label="Close event editor"
                className="rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-semibold text-on-secondary transition hover:opacity-90 disabled:opacity-60"
                disabled={isSavingScheduleEdit}
                onClick={() => setEditingOccurrence(null)}
                type="button"
              >
                Close
              </button>
            </div>

            {editingOccurrence.isRecurring && (
              <div className="mt-5">
                <p className="text-sm font-medium text-on-primary">Apply changes to</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {[
                    { value: 'occurrence', label: 'Just this event' },
                    { value: 'future', label: 'This and all future events' },
                  ].map((option) => {
                    const isActive = editScope === option.value;

                    return (
                      <button
                        aria-pressed={isActive}
                        className={`rounded-2xl border p-4 text-left text-sm font-semibold transition ${
                          isActive
                            ? 'border-accent bg-accent/12 text-on-primary'
                            : 'border-border bg-secondary text-on-secondary hover:bg-accent/10'
                        }`}
                        key={option.value}
                        onClick={() => handleEditScopeChange(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <ScheduleEventForm
              form={editScheduleForm}
              isLoadingTasks={isLoadingTasks}
              isSaving={isSavingScheduleEdit}
              lockScheduleType={editingOccurrence.isRecurring && editScope === 'occurrence'}
              onFieldChange={handleEditScheduleFieldChange}
              onSubmit={handleScheduleEditSubmit}
              submitLabel="Save Changes"
              tasks={tasks}
            />

            {editStatusMessage && (
              <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
                {editStatusMessage}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
};

export default CoachDashboard;

