import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/shared/Button';
import { studentAuthConfig, taskConfig } from '../config/appConfig';
import { ROUTES } from '../config/routesConfig';
import { useSchedules } from '../features/schedules/useSchedules';
import {
  getAvailableSignInTasks,
  isTaskNoteRequired,
  taskMatchesReference,
} from '../features/tasks/taskUtils';
import { useTasks } from '../features/tasks/useTasks';
import { FORM_TEXTAREA_CLASS_NAME } from '../styles/classNames';
import {
  endStaleStudentSession,
  endStudentSession,
  startStudentSession,
} from '../features/timeLogs/timeLogService';
import { useAuth } from '../features/auth/useAuth.jsx';
import { useCurrentTime } from '../hooks/useCurrentTime';

const StudentSession = () => {
  const [formMode, setFormMode] = useState('sign-in');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const staleSessionAttemptRef = useRef('');
  const { signOutStudent, studentSession } = useAuth();
  const { tasks, isLoading: isLoadingTasks, error: tasksError } = useTasks();
  const { schedules, isLoading: isLoadingSchedules, error: schedulesError } = useSchedules();
  const currentTime = useCurrentTime();
  const navigate = useNavigate();

  // Open tasks are always shown; scheduled tasks are shown only during an
  // active schedule window.
  const availableTasks = useMemo(
    () => getAvailableSignInTasks(tasks, schedules, currentTime),
    [currentTime, schedules, tasks],
  );

  const currentStudentTask = useMemo(() => {
    // Prefer the stable task id when it exists. The name fallback is only for
    // older student documents that were saved before currentTaskId was added.
    if (studentSession?.[studentAuthConfig.currentTaskIdField]) {
      return tasks.find((task) => task.id === studentSession[studentAuthConfig.currentTaskIdField]) ?? null;
    }

    return tasks.find((task) => taskMatchesReference(task, studentSession?.currentTask)) ?? null;
  }, [
    studentSession?.currentTask,
    studentSession?.[studentAuthConfig.currentTaskIdField],
    tasks,
  ]);

  const currentlySelectedTask = useMemo(() => {
    if (formMode === 'sign-out') {
      return currentStudentTask;
    }

    return availableTasks.find((task) => task.id === selectedTaskId) ?? null;
  }, [availableTasks, currentStudentTask, formMode, selectedTaskId]);
  const taskDisplayName = currentlySelectedTask?.[taskConfig.nameField] ?? 'task';
  const isNoteRequired = useMemo(() => isTaskNoteRequired({
    currentTime: formMode === 'sign-out'
      ? studentSession?.[studentAuthConfig.signedInAtField] ?? currentTime
      : currentTime,
    mode: formMode,
    schedules,
    task: currentlySelectedTask,
  }), [
    currentTime,
    currentlySelectedTask,
    formMode,
    schedules,
    studentSession,
  ]);

  useEffect(() => {
    setFormMode(studentSession?.[studentAuthConfig.signedInField] ? 'sign-out' : 'sign-in');
  }, [studentSession]);

  useEffect(() => {
    if (studentSession?.[studentAuthConfig.signedInField]) {
      setSelectedTaskId('');
    }
  }, [studentSession]);

  useEffect(() => {
    if (formMode !== 'sign-in') {
      if (selectedTaskId) {
        setSelectedTaskId('');
      }

      return;
    }

    if (availableTasks.length === 1) {
      setSelectedTaskId(availableTasks[0].id);
      return;
    }

    if (
      selectedTaskId
      && !availableTasks.some((task) => task.id === selectedTaskId)
    ) {
      setSelectedTaskId('');
    }
  }, [availableTasks, formMode, selectedTaskId]);

  useEffect(() => {
    setStatusMessage('');
  }, [formMode, selectedTaskId, notes]);

  useEffect(() => {
    const activeTimeLogId = studentSession?.[studentAuthConfig.activeTimeLogIdField];

    if (
      !studentSession?.[studentAuthConfig.signedInField]
      || !activeTimeLogId
      || isLoadingSchedules
      || staleSessionAttemptRef.current === activeTimeLogId
    ) {
      return;
    }

    // Remember the log ID so normal re-renders do not repeat the same Firestore
    // cleanup request.
    staleSessionAttemptRef.current = activeTimeLogId;

    endStaleStudentSession({
      schedules,
      student: studentSession,
    }).then(async (didEndSession) => {
      if (!didEndSession) {
        return;
      }

      const destination = studentSession.authMode === 'kiosk'
        ? ROUTES.kiosk
        : ROUTES.accessPortal;
      await signOutStudent();
      navigate(destination, { replace: true });
    }).catch((autoCheckoutError) => {
      setStatusMessage(
        autoCheckoutError.message || 'Failed to automatically close the previous session.',
      );
    });
  }, [
    isLoadingSchedules,
    navigate,
    schedules,
    signOutStudent,
    studentSession,
  ]);

  const handleSignOut = async () => {
    const destination = studentSession?.authMode === 'kiosk'
      ? ROUTES.kiosk
      : ROUTES.accessPortal;

    await signOutStudent();
    navigate(destination, { replace: true });
  };

  const handleBackToDashboard = () => {
    navigate(ROUTES.studentDashboard);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formMode === 'sign-in' && !currentlySelectedTask) {
      setStatusMessage(
        'Select a task before submitting.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const destination = studentSession?.authMode === 'kiosk'
        ? ROUTES.kiosk
        : ROUTES.accessPortal;

      if (formMode === 'sign-in') {
        await startStudentSession({
          student: studentSession,
          task: currentlySelectedTask,
          signInNotes: notes,
        });
        await signOutStudent();
        navigate(destination, { replace: true });
        return;
      } else {
        const activeTimeLogId = studentSession?.[studentAuthConfig.activeTimeLogIdField];

        if (!activeTimeLogId) {
          throw new Error('No active time log is stored for this student.');
        }

        // Sign-out only requires the active log id. The selected task card is
        // display-only so a missing task document does not block checkout.
        await endStudentSession({
          studentDocId: studentSession.id,
          timeLogId: activeTimeLogId,
          signOutNotes: notes,
        });
        await signOutStudent();
        navigate(destination, { replace: true });
        return;
      }
    } catch (submitError) {
      setStatusMessage(submitError.message || 'Failed to update student session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,_var(--app-secondary)_25%,_transparent)_0%,_transparent_45%)]" />
      <div className="absolute -left-20 top-40 h-48 w-48 rounded-full bg-secondary/15 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-secondary/17 blur-3xl" />

      <section className="relative w-full max-w-3xl rounded-[2rem] border border-border/70 bg-[linear-gradient(135deg,var(--app-primary)_20%,color-mix(in_oklab,var(--app-primary)_70%,var(--app-accent))_80%,var(--app-accent)_100%)] p-8 shadow-2xl shadow-primary/10">
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">Student Hours</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-on-primary">
              {formMode === 'sign-in' ? 'Sign in to your session' : 'Sign out of your session'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-on-primary-muted">
              Signed in as <span className="font-semibold text-on-primary">{studentSession?.name}</span> with student ID <span className="font-semibold text-on-primary">{studentSession?.studentId}</span>.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:w-auto sm:flex-row">
            {studentSession?.authMode === 'student' && (
              <Button
                className="border border-on-primary/20 bg-transparent shadow-none sm:w-auto"
                onClick={handleBackToDashboard}
                type="button"
              >
                Back to Dashboard
              </Button>
            )}
            <Button className="sm:w-auto" onClick={handleSignOut} type="button">
              Sign out student session
            </Button>
          </div>
        </div>

        {formMode === 'sign-out' ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3">
              <p className="text-left text-sm font-medium text-on-primary">
                Current action:
              </p>
              <p className="mt-1 text-left text-base font-semibold text-on-primary">
                Sign Out
              </p>
            </div>

            <div className="rounded-2xl border border-primary bg-primary px-4 py-3 text-on-primary shadow-lg shadow-primary/20">
              <p className="text-sm font-medium text-on-primary">Current task</p>
              <p className="mt-1 text-base font-semibold text-on-primary">
                {currentStudentTask?.[taskConfig.nameField] ?? 'No current task found'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3">
            <p className="text-left text-sm font-medium text-on-primary">
              Current action:
            </p>
            <p className="mt-1 text-left text-base font-semibold text-on-primary">
              Sign In
            </p>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {formMode === 'sign-out' ? (
            <>
              {!currentStudentTask && (
                <p className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-on-primary">
                  No matching task was found for the student {studentAuthConfig.currentTaskField} value.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-on-primary">Task</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {availableTasks.map((task) => (
                  <button
                    key={task.id}
                    className={`rounded-xl border px-4 py-3 text-center font-semibold transition ${
                      selectedTaskId === task.id
                        ? 'border-secondary bg-primary text-on-primary shadow-lg shadow-primary/20'
                        : 'border-border bg-secondary text-on-secondary hover:bg-accent/10'
                    }`}
                    onClick={() => setSelectedTaskId(task.id)}
                    type="button"
                  >
                    <span className="block">{task[taskConfig.nameField]}</span>
                  </button>
                ))}
              </div>
              {!isLoadingTasks && availableTasks.length === 0 && (
                <p className="text-sm text-on-secondary">No tasks are currently available.</p>
              )}
              {(isLoadingTasks || isLoadingSchedules) && <p className="text-sm text-text-muted">Loading tasks...</p>}
              {(tasksError || schedulesError) && (
                <p className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-on-secondary">
                  {tasksError || schedulesError}
                </p>
              )}
              {!selectedTaskId && availableTasks.length > 0 && (
                <p className="text-sm text-on-secondary">Select one task to continue.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-primary" htmlFor="student-notes">
              {formMode === 'sign-in'
                ? `Goal for ${taskDisplayName}`
                : `Completed for ${taskDisplayName}`}
              {isNoteRequired ? ' (required)' : ' (optional)'}
            </label>
            <textarea
              className={`${FORM_TEXTAREA_CLASS_NAME} min-h-32`}
              id="student-notes"
              required={isNoteRequired}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                formMode === 'sign-in'
                  ? `${isNoteRequired ? 'Required' : 'Optional'} goal for ${taskDisplayName}`
                  : `${isNoteRequired ? 'Required' : 'Optional'} summary of what you completed for ${taskDisplayName}`
              }
              value={notes}
            />
          </div>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting
              ? 'Saving...'
              : formMode === 'sign-in'
                ? 'Submit Sign-In'
                : 'Submit Sign-Out'}
          </Button>
        </form>

        {statusMessage && (
          <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-on-secondary">
            {statusMessage}
          </div>
        )}
      </section>
    </main>
  );
};

export default StudentSession;
