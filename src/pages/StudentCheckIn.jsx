import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/shared/Button';
import { scheduleConfig, studentAuthConfig, taskConfig } from '../config/appConfig';
import { isScheduleActive } from '../features/schedules/validateSchedule';
import { useSchedules } from '../features/schedules/useSchedules';
import { useTasks } from '../features/tasks/useTasks';
import { endStudentSession, startStudentSession } from '../features/timeLogs/timeLogService';
import { useAuth } from '../features/auth/useAuth.jsx';

const normalizeTaskRef = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

const taskMatchesReference = (task, reference) => {
  const normalizedReference = normalizeTaskRef(reference);

  if (!normalizedReference) {
    return false;
  }

  return (
    normalizeTaskRef(task.id) === normalizedReference
    || normalizeTaskRef(task[taskConfig.nameField]) === normalizedReference
  );
};

const StudentCheckIn = () => {
  const [formMode, setFormMode] = useState('sign-in');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signOutStudent, studentSession } = useAuth();
  const { tasks, isLoading: isLoadingTasks, error: tasksError } = useTasks();
  const { schedules, isLoading: isLoadingSchedules, error: schedulesError } = useSchedules();
  const currentTime = new Date();
  const navigate = useNavigate();

  const unscheduledTasks = useMemo(
    () => tasks.filter((task) => !task[taskConfig.scheduledField]),
    [tasks],
  );

  const scheduledTasks = useMemo(
    () => tasks.filter((task) => Boolean(task[taskConfig.scheduledField])),
    [tasks],
  );

  const activeScheduledTaskIds = useMemo(() => {
    const activeTaskKeys = new Set();

    schedules
      .filter((schedule) => isScheduleActive(schedule, currentTime))
      .forEach((schedule) => {
        activeTaskKeys.add(normalizeTaskRef(schedule[scheduleConfig.taskIdField]));
      });

    return activeTaskKeys;
  }, [currentTime, schedules]);

  const availableTasks = useMemo(() => {
    return [
      ...unscheduledTasks,
      ...scheduledTasks.filter((task) => {
        const taskIdKey = normalizeTaskRef(task.id);
        const taskNameKey = normalizeTaskRef(task[taskConfig.nameField]);

        return (
          activeScheduledTaskIds.has(taskIdKey)
          || activeScheduledTaskIds.has(taskNameKey)
        );
      }),
    ];
  }, [activeScheduledTaskIds, scheduledTasks, unscheduledTasks]);

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

  useEffect(() => {
    setFormMode(studentSession?.[studentAuthConfig.signedInField] ? 'sign-out' : 'sign-in');
  }, [studentSession]);

  useEffect(() => {
    if (studentSession?.[studentAuthConfig.signedInField]) {
      setSelectedTaskId('');
    }
  }, [studentSession]);

  useEffect(() => {
    setStatusMessage('');
  }, [formMode, selectedTaskId, notes]);

  const handleSignOut = () => {
    signOutStudent();
    navigate('/', { replace: true });
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
      if (formMode === 'sign-in') {
        await startStudentSession({
          student: studentSession,
          task: currentlySelectedTask,
          signInNotes: notes,
        });
        signOutStudent();
        navigate('/', { replace: true });
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
        signOutStudent();
        navigate('/', { replace: true });
        return;
      }
    } catch (submitError) {
      setStatusMessage(submitError.message || 'Failed to update student session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-3xl rounded-[2rem] border border-border bg-secondary p-8 shadow-2xl shadow-primary/10">
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Student Hours</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text">
              {formMode === 'sign-in' ? 'Sign in to your session' : 'Sign out of your session'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              Signed in as <span className="font-semibold text-text">{studentSession?.name}</span> with student ID <span className="font-semibold text-text">{studentSession?.studentId}</span>.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:w-auto">
            <Button className="sm:w-auto" onClick={handleSignOut} type="button">
              Sign out student session
            </Button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3">
          <p className="text-sm font-medium text-text" align="left">
            Current action:
          </p>
          <p className="mt-1 text-base font-semibold text-primary" align="left ">
            {formMode === 'sign-in' ? 'Sign In' : 'Sign Out'}
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {formMode === 'sign-out' ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text">Current task</p>
              <div className="rounded-2xl border border-primary bg-primary px-4 py-3 text-on-primary shadow-lg shadow-primary/20">
                <div className="grid gap-3 sm:grid-cols-2 "></div>
                  <p className="text-sm font-semibold" >
                    {currentStudentTask?.[taskConfig.nameField] ?? 'No current task found'}
                    </p>
              </div>
              {!currentStudentTask && (
                <p className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-text">
                  No matching task was found for the student {studentAuthConfig.currentTaskField} value.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text">Task</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {availableTasks.map((task) => (
                  <button
                    key={task.id}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      selectedTaskId === task.id
                        ? 'border-primary bg-primary text-on-primary shadow-lg shadow-primary/20'
                        : 'border-border bg-secondary text-text hover:bg-accent/10'
                    }`}
                    onClick={() => setSelectedTaskId(task.id)}
                    type="button"
                  >
                    <span className="block">{task[taskConfig.nameField]}</span>
                    <span className={`mt-1 block text-xs ${selectedTaskId === task.id ? 'text-on-primary/80' : 'text-text-muted'}`}>
                      {task[taskConfig.scheduledField] ? 'Scheduled task' : 'Open task'}
                    </span>
                  </button>
                ))}
              </div>
              {!isLoadingTasks && availableTasks.length === 0 && (
                <p className="text-sm text-text-muted">No tasks are currently available.</p>
              )}
              {(isLoadingTasks || isLoadingSchedules) && <p className="text-sm text-text-muted">Loading tasks...</p>}
              {(tasksError || schedulesError) && (
                <p className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-text">
                  {tasksError || schedulesError}
                </p>
              )}
              {!selectedTaskId && availableTasks.length > 0 && (
                <p className="text-sm text-text-muted">Select one task to continue.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text" htmlFor="student-notes">
              {formMode === 'sign-in'
                ? `Goal for ${taskDisplayName}`
                : `Completed for ${taskDisplayName}`}
            </label>
            <textarea
              className="min-h-32 w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-muted/70 focus:border-primary focus:ring-4 focus:ring-primary/15"
              id="student-notes"
              required
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                formMode === 'sign-in'
                  ? `Required goal for ${taskDisplayName}`
                  : `Required summary of what you completed for ${taskDisplayName}`
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
          <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-text">
            {statusMessage}
          </div>
        )}
      </section>
    </main>
  );
};

export default StudentCheckIn;
