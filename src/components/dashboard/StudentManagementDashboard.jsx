import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { scheduleConfig, studentAuthConfig, taskConfig, timeLogConfig } from '../../config/appConfig';
import { useAuth } from '../../features/auth/useAuth.jsx';
import { isScheduleActive } from '../../features/schedules/validateSchedule';
import { useSchedules } from '../../features/schedules/useSchedules';
import { createStudent, updateStudent } from '../../features/students/studentService';
import { useStudents } from '../../features/students/useStudents';
import { useTasks } from '../../features/tasks/useTasks';
import { useCompletedTimeLogs } from '../../features/timeLogs/useCompletedTimeLogs';
import {
  createExtraHoursTimeLog,
  listTimeLogsForStudent,
  startStudentSession,
  updateTimeLogByCoach,
} from '../../features/timeLogs/timeLogService';
import {
  formatTaskName,
  getDurationMinutes,
  isCompletedLog,
  isExtraHoursTaskName,
  minutesToHours,
} from '../../lib/analyticsUtils';
import { toDate } from '../../lib/dateUtils';
import Button from '../shared/Button';

const defaultCardClassName = 'rounded-[1.75rem] border border-on-primary/15 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--app-primary)_88%,transparent)_0%,color-mix(in_oklab,var(--app-primary)_72%,var(--app-accent))_58%,color-mix(in_oklab,var(--app-accent)_72%,transparent)_100%)] p-6 shadow-lg shadow-primary/15 backdrop-blur-sm';
const inputClassName = 'w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-on-secondary outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15';
const tableHeaderClassName = 'px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-on-primary';
const tableCellClassName = 'border-y border-border bg-secondary px-4 py-3 text-sm text-on-secondary';
const timeLogsPageSize = 10;

const emptyCreateForm = {
  currentMember: true,
  name: '',
  password: '',
  studentId: '',
};

const emptyEditForm = {
  currentMember: false,
  name: '',
  password: '',
  studentId: '',
};

const currentMemberOptions = [
  {
    value: true,
    title: 'Current Member',
    description: 'Student appears on the active team roster.',
  },
  {
    value: false,
    title: 'Not Current',
    description: 'Student is kept in records but hidden from the active roster.',
  },
];

const nullableString = (value) => {
  const trimmedValue = String(value ?? '').trim();

  return trimmedValue || null;
};

const normalizeStudentId = (studentId) => String(studentId ?? '').trim().toLowerCase();

const getStudentName = (student) => String(student?.name ?? '').trim() || 'Student';

const getStudentId = (student) => String(
  student?.[studentAuthConfig.idField] ?? student?.studentId ?? '',
).trim();

const getCurrentMemberValue = (student) => (
  student?.[studentAuthConfig.currentMemberField] ?? student?.['current member'] ?? false
) === true;

const sortStudentsByName = (students) => [...students].sort((left, right) => (
  getStudentName(left).localeCompare(getStudentName(right))
  || getStudentId(left).localeCompare(getStudentId(right))
));

const normalizeTaskRef = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

const getAvailableSignInTasks = (tasks, schedules) => {
  const activeScheduledTaskIds = new Set();
  const currentTime = new Date();

  schedules
    .filter((schedule) => isScheduleActive(schedule, currentTime))
    .forEach((schedule) => {
      activeScheduledTaskIds.add(normalizeTaskRef(schedule[scheduleConfig.taskIdField]));
    });

  return tasks.filter((task) => {
    if (!task[taskConfig.scheduledField]) {
      return true;
    }

    const taskIdKey = normalizeTaskRef(task.id);
    const taskNameKey = normalizeTaskRef(task[taskConfig.nameField]);

    return (
      activeScheduledTaskIds.has(taskIdKey)
      || activeScheduledTaskIds.has(taskNameKey)
    );
  });
};

const toDateTimeLocalValue = (value) => {
  const date = toDate(value);

  if (!date) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getTimeLogTaskNameFormValue = (value) => {
  const taskName = String(value ?? '').trim();

  return isExtraHoursTaskName(taskName) ? formatTaskName(taskName) : taskName;
};

const buildTimeLogForm = (log) => ({
  signInAt: toDateTimeLocalValue(log?.[timeLogConfig.signInAtField]),
  signInNotes: log?.[timeLogConfig.signInNotesField] ?? '',
  signOutAt: toDateTimeLocalValue(log?.[timeLogConfig.signOutAtField]),
  signOutNotes: log?.[timeLogConfig.signOutNotesField] ?? '',
  taskName: getTimeLogTaskNameFormValue(log?.[timeLogConfig.taskNameField]),
});

const buildStudentHourTotals = (logs) => {
  const totalsByStudent = new Map();

  logs.filter(isCompletedLog).forEach((log) => {
    const durationMinutes = getDurationMinutes(log);
    const studentDocId = String(log?.[timeLogConfig.studentDocIdField] ?? '').trim();
    const studentId = String(log?.[timeLogConfig.studentIdField] ?? '').trim();
    const keys = [
      studentDocId ? `doc:${studentDocId}` : '',
      studentId ? `student:${studentId}` : '',
      studentId ? `student:${studentId.toLowerCase()}` : '',
    ].filter(Boolean);

    keys.forEach((key) => {
      totalsByStudent.set(key, (totalsByStudent.get(key) ?? 0) + durationMinutes);
    });
  });

  return totalsByStudent;
};

const getStudentTotalMinutes = (student, totalsByStudent) => {
  const studentId = getStudentId(student);
  const keys = [
    student?.id ? `doc:${student.id}` : '',
    studentId ? `student:${studentId}` : '',
    studentId ? `student:${studentId.toLowerCase()}` : '',
  ].filter(Boolean);

  for (const key of keys) {
    const totalMinutes = totalsByStudent.get(key);

    if (totalMinutes !== undefined) {
      return totalMinutes;
    }
  }

  return 0;
};

const CardMessage = ({ children, tone = 'muted' }) => (
  <div
    className={`mt-5 rounded-2xl border px-4 py-4 text-sm ${
      tone === 'error'
        ? 'border-accent/30 bg-accent/12 text-on-primary'
        : 'border-border bg-accent/10 text-on-primary/80'
    }`}
  >
    {children}
  </div>
);

const PasswordField = ({
  id,
  label,
  onChange,
  placeholder,
  required = false,
  showPassword,
  toggleShowPassword,
  value,
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-medium text-on-primary">{label}</span>
    <div className="relative">
      <input
        className={`${inputClassName} pr-20`}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={showPassword ? 'text' : 'password'}
        value={value}
      />
      <button
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-border bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition hover:bg-accent/20"
        onClick={toggleShowPassword}
        type="button"
      >
        {showPassword ? 'Hide' : 'Show'}
      </button>
    </div>
  </label>
);

const CreateStudentCard = ({ cardClassName }) => {
  const [form, setForm] = useState(emptyCreateForm);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState({ message: '', tone: 'muted' });

  const handleFieldChange = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setStatus({ message: '', tone: 'muted' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setStatus({ message: '', tone: 'muted' });

    try {
      await createStudent(form);
      setForm(emptyCreateForm);
      setShowPassword(false);
      setStatus({ message: 'Student account created.', tone: 'muted' });
    } catch (error) {
      setStatus({
        message: error?.message || 'Failed to create the student account.',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className={cardClassName}>
      <div className="border-b border-border pb-5">
        <h3 className="text-lg font-semibold text-on-primary">Create New Student</h3>
        <p className="mt-2 text-sm leading-6 text-on-primary/80">
          Adds the student to Firestore and creates their Firebase Authentication sign-in.
        </p>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">Name</span>
          <input
            className={inputClassName}
            onChange={(event) => handleFieldChange('name', event.target.value)}
            placeholder="Jane Doe"
            required
            type="text"
            value={form.name}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">Student ID</span>
          <input
            className={inputClassName}
            onChange={(event) => handleFieldChange('studentId', event.target.value)}
            placeholder="12345"
            required
            type="text"
            value={form.studentId}
          />
        </label>

        <PasswordField
          id="new-student-password"
          label="Password"
          onChange={(value) => handleFieldChange('password', value)}
          placeholder="Minimum 6 characters"
          required
          showPassword={showPassword}
          toggleShowPassword={() => setShowPassword((currentValue) => !currentValue)}
          value={form.password}
        />

        <label className="flex items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-on-secondary">
          <input
            checked={form.currentMember}
            className="h-4 w-4 accent-primary"
            onChange={(event) => handleFieldChange('currentMember', event.target.checked)}
            type="checkbox"
          />
          Current member
        </label>

        <Button disabled={isSaving} type="submit">
          {isSaving ? 'Creating Student...' : 'Create Student'}
        </Button>
      </form>

      {status.message && <CardMessage tone={status.tone}>{status.message}</CardMessage>}
    </article>
  );
};

const ActiveRosterCard = ({
  cardClassName,
  error,
  isLoading,
  rosterStudents,
  totalRosterHours,
}) => (
  <article className={cardClassName}>
    <div className="border-b border-border pb-5">
      <h3 className="text-lg font-semibold text-on-primary">Active Team Roster</h3>
      <p className="mt-2 text-sm leading-6 text-on-primary/80">
        Current members with their all-time completed hours.
      </p>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="flex min-h-[104px] flex-col items-center justify-center rounded-2xl border border-border bg-secondary px-4 py-4 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-secondary/80">Current Members</p>
        <p className="mt-2 text-2xl font-semibold text-on-secondary">{rosterStudents.length}</p>
      </div>
      <div className="flex min-h-[104px] flex-col items-center justify-center rounded-2xl border border-border bg-secondary px-4 py-4 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-secondary/80">Total Hours</p>
        <p className="mt-2 text-2xl font-semibold text-on-secondary">{totalRosterHours.toFixed(1)}</p>
      </div>
    </div>

    {isLoading ? (
      <CardMessage>Loading roster...</CardMessage>
    ) : error ? (
      <CardMessage tone="error">{error}</CardMessage>
    ) : rosterStudents.length === 0 ? (
      <CardMessage>No current members found.</CardMessage>
    ) : (
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr>
              <th className={tableHeaderClassName}>Name</th>
              <th className={tableHeaderClassName}>Student ID</th>
              <th className={`${tableHeaderClassName} text-right`}>Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {rosterStudents.map((student) => (
              <tr key={student.id}>
                <td className={`${tableCellClassName} rounded-l-xl border-l font-semibold`}>
                  {getStudentName(student)}
                </td>
                <td className={tableCellClassName}>{getStudentId(student) || 'Not set'}</td>
                <td className={`${tableCellClassName} rounded-r-xl border-r text-right font-semibold`}>
                  {student.totalHours.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </article>
);

const SignInStudentCard = ({
  cardClassName,
  error,
  isLoading,
  students,
  tasks,
}) => {
  const availableStudents = useMemo(
    () => sortStudentsByName(students).filter((student) => student[studentAuthConfig.signedInField] !== true),
    [students],
  );
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState({ message: '', tone: 'muted' });

  const selectedStudent = useMemo(
    () => availableStudents.find((student) => student.id === selectedStudentId) ?? null,
    [availableStudents, selectedStudentId],
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  useEffect(() => {
    if (availableStudents.length === 0) {
      setSelectedStudentId('');
      return;
    }

    const selectedStudentStillAvailable = availableStudents.some((student) => student.id === selectedStudentId);

    if (!selectedStudentStillAvailable) {
      setSelectedStudentId(availableStudents[0].id);
    }
  }, [availableStudents, selectedStudentId]);

  useEffect(() => {
    if (selectedTaskId && !tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId('');
    }
  }, [selectedTaskId, tasks]);

  const clearStatus = () => setStatus({ message: '', tone: 'muted' });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedStudent) {
      setStatus({ message: 'Select a student before signing in.', tone: 'error' });
      return;
    }

    if (!selectedTask) {
      setStatus({ message: 'Select a task before signing in.', tone: 'error' });
      return;
    }

    const trimmedNotes = notes.trim();

    if (!trimmedNotes) {
      setStatus({ message: 'A goal note is required to sign in a student.', tone: 'error' });
      return;
    }

    setIsSaving(true);
    clearStatus();

    try {
      await startStudentSession({
        student: selectedStudent,
        task: selectedTask,
        signInNotes: trimmedNotes,
      });

      setSelectedTaskId('');
      setNotes('');
      setStatus({ message: `${getStudentName(selectedStudent)} signed in.`, tone: 'muted' });
    } catch (submitError) {
      setStatus({
        message: submitError?.message || 'Failed to sign in the student.',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className={cardClassName}>
      <div className="border-b border-border pb-5">
        <h3 className="text-lg font-semibold text-on-primary">Sign In Student</h3>
        <p className="mt-2 text-sm leading-6 text-on-primary/80">
          Starts a student session and creates the matching active time log.
        </p>
      </div>

      {isLoading ? (
        <CardMessage>Loading students and tasks...</CardMessage>
      ) : error ? (
        <CardMessage tone="error">{error}</CardMessage>
      ) : availableStudents.length === 0 ? (
        <CardMessage>No students are available to sign in.</CardMessage>
      ) : (
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Student</span>
            <select
              className={inputClassName}
              onChange={(event) => {
                setSelectedStudentId(event.target.value);
                clearStatus();
              }}
              value={selectedStudentId}
            >
              {availableStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {getStudentName(student)} ({getStudentId(student) || 'No ID'})
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-sm font-medium text-on-primary">Task</span>
            {tasks.length === 0 ? (
              <p className="mt-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-on-secondary">
                No tasks are currently available.
              </p>
            ) : (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {tasks.map((task) => {
                  const isActive = selectedTaskId === task.id;

                  return (
                    <button
                      key={task.id}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        isActive
                          ? 'border-secondary bg-primary text-on-primary shadow-lg shadow-primary/20'
                          : 'border-border bg-secondary text-on-secondary hover:bg-accent/10'
                      }`}
                      onClick={() => {
                        setSelectedTaskId(task.id);
                        clearStatus();
                      }}
                      type="button"
                    >
                      <span className="block">{task[taskConfig.nameField]}</span>
                      <span className={`mt-1 block text-sm ${isActive ? 'text-on-primary/80' : 'text-on-secondary'}`}>
                        {task[taskConfig.scheduledField] ? 'Scheduled task' : 'Open task'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">
              Goal for {selectedTask?.[taskConfig.nameField] ?? 'task'}
            </span>
            <textarea
              className="min-h-28 w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-on-secondary outline-none transition placeholder:text-on-secondary/70 focus:border-primary focus:ring-4 focus:ring-primary/15"
              onChange={(event) => {
                setNotes(event.target.value);
                clearStatus();
              }}
              placeholder={`Required goal for ${selectedTask?.[taskConfig.nameField] ?? 'task'}`}
              required
              value={notes}
            />
          </label>

          <Button disabled={isSaving || tasks.length === 0} type="submit">
            {isSaving ? 'Signing In...' : 'Sign In Student'}
          </Button>
        </form>
      )}

      {status.message && <CardMessage tone={status.tone}>{status.message}</CardMessage>}
    </article>
  );
};

const ExtraHoursCard = ({
  cardClassName,
  enteredBy,
  error,
  isLoading,
  students,
}) => {
  const sortedStudents = useMemo(() => sortStudentsByName(students), [students]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [hours, setHours] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState({ message: '', tone: 'muted' });

  const selectedStudent = useMemo(
    () => sortedStudents.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, sortedStudents],
  );

  useEffect(() => {
    if (sortedStudents.length === 0) {
      setSelectedStudentId('');
      return;
    }

    const selectedStudentStillExists = sortedStudents.some((student) => student.id === selectedStudentId);

    if (!selectedStudentStillExists) {
      setSelectedStudentId(sortedStudents[0].id);
    }
  }, [selectedStudentId, sortedStudents]);

  const clearStatus = () => setStatus({ message: '', tone: 'muted' });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedStudent) {
      setStatus({ message: 'Select a student before adding extra hours.', tone: 'error' });
      return;
    }

    setIsSaving(true);
    clearStatus();

    try {
      await createExtraHoursTimeLog({
        enteredBy,
        hours,
        reason,
        student: selectedStudent,
      });

      setHours('');
      setReason('');
      setStatus({ message: `Extra hours added for ${getStudentName(selectedStudent)}.`, tone: 'muted' });
    } catch (submitError) {
      setStatus({
        message: submitError?.message || 'Failed to add extra hours.',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className={cardClassName}>
      <div className="border-b border-border pb-5">
        <h3 className="text-lg font-semibold text-on-primary">Extra Hours</h3>
        <p className="mt-2 text-sm leading-6 text-on-primary/80">
          Add completed manual hours with a reason for reports.
        </p>
      </div>

      {isLoading ? (
        <CardMessage>Loading students...</CardMessage>
      ) : error ? (
        <CardMessage tone="error">{error}</CardMessage>
      ) : sortedStudents.length === 0 ? (
        <CardMessage>No students found.</CardMessage>
      ) : (
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Student</span>
            <select
              className={inputClassName}
              onChange={(event) => {
                setSelectedStudentId(event.target.value);
                clearStatus();
              }}
              value={selectedStudentId}
            >
              {sortedStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {getStudentName(student)} ({getStudentId(student) || 'No ID'})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Hours</span>
            <input
              className={inputClassName}
              min="0.01"
              onChange={(event) => {
                setHours(event.target.value);
                clearStatus();
              }}
              placeholder="1.5"
              required
              step="0.01"
              type="number"
              value={hours}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Reason</span>
            <textarea
              className="min-h-28 w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-on-secondary outline-none transition placeholder:text-on-secondary/70 focus:border-primary focus:ring-4 focus:ring-primary/15"
              onChange={(event) => {
                setReason(event.target.value);
                clearStatus();
              }}
              placeholder="Why these hours are being added"
              required
              value={reason}
            />
          </label>

          <Button disabled={isSaving} type="submit">
            {isSaving ? 'Adding Hours...' : 'Add Extra Hours'}
          </Button>
        </form>
      )}

      {status.message && <CardMessage tone={status.tone}>{status.message}</CardMessage>}
    </article>
  );
};

const EditStudentCard = ({
  cardClassName,
  error,
  isLoading,
  students,
}) => {
  const sortedStudents = useMemo(() => sortStudentsByName(students), [students]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [form, setForm] = useState(emptyEditForm);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState({ message: '', tone: 'muted' });

  const selectedStudent = useMemo(
    () => sortedStudents.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, sortedStudents],
  );

  useEffect(() => {
    if (sortedStudents.length === 0) {
      setSelectedStudentId('');
      return;
    }

    const selectedStudentStillExists = sortedStudents.some((student) => student.id === selectedStudentId);

    if (!selectedStudentStillExists) {
      setSelectedStudentId(sortedStudents[0].id);
    }
  }, [selectedStudentId, sortedStudents]);

  useEffect(() => {
    if (!selectedStudent) {
      setForm(emptyEditForm);
      return;
    }

    setForm({
      currentMember: getCurrentMemberValue(selectedStudent),
      name: selectedStudent.name ?? '',
      password: '',
      studentId: getStudentId(selectedStudent),
    });
    setShowPassword(false);
    setStatus({ message: '', tone: 'muted' });
  }, [selectedStudentId]);

  const handleFieldChange = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setStatus({ message: '', tone: 'muted' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedStudent) {
      return;
    }

    const normalizedStudentId = normalizeStudentId(form.studentId);
    const originalStudentId = normalizeStudentId(getStudentId(selectedStudent));
    const trimmedPassword = form.password.trim();

    if (!nullableString(form.name) || !normalizedStudentId) {
      setStatus({ message: 'Student name and student ID are required.', tone: 'error' });
      return;
    }

    if (trimmedPassword && trimmedPassword.length < 6) {
      setStatus({ message: 'Student passwords must be at least 6 characters.', tone: 'error' });
      return;
    }

    if (normalizedStudentId !== originalStudentId) {
      setStatus({
        message: 'Student ID changes require a matching Firebase Auth update through a trusted Firebase Admin backend.',
        tone: 'error',
      });
      return;
    }

    setIsSaving(true);
    setStatus({ message: '', tone: 'muted' });

    try {
      const updates = {
        name: nullableString(form.name),
        [studentAuthConfig.idField]: normalizedStudentId,
        [studentAuthConfig.currentMemberField]: form.currentMember,
      };

      await updateStudent({
        password: trimmedPassword,
        studentDocId: selectedStudent.id,
        updates,
      });

      setForm((currentForm) => ({
        ...currentForm,
        password: '',
      }));
      setShowPassword(false);
      setStatus({ message: 'Student details saved.', tone: 'muted' });
    } catch (error) {
      setStatus({
        message: error?.message || 'Failed to save student details.',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className={cardClassName}>
      <div className="border-b border-border pb-5">
        <h3 className="text-lg font-semibold text-on-primary">Edit Student</h3>
        <p className="mt-2 text-sm leading-6 text-on-primary/80">
          Select a student and update their Firestore profile fields.
        </p>
      </div>

      {isLoading ? (
        <CardMessage>Loading students...</CardMessage>
      ) : error ? (
        <CardMessage tone="error">{error}</CardMessage>
      ) : sortedStudents.length === 0 ? (
        <CardMessage>No students found.</CardMessage>
      ) : (
        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-sm font-medium text-on-primary">Student</span>
            <select
              className={inputClassName}
              onChange={(event) => {
                setSelectedStudentId(event.target.value);
                setStatus({ message: '', tone: 'muted' });
              }}
              value={selectedStudentId}
            >
              {sortedStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {getStudentName(student)} ({getStudentId(student) || 'No ID'})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Name</span>
            <input
              className={inputClassName}
              onChange={(event) => handleFieldChange('name', event.target.value)}
              required
              type="text"
              value={form.name}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Student ID</span>
            <input
              className={inputClassName}
              onChange={(event) => handleFieldChange('studentId', event.target.value)}
              required
              type="text"
              value={form.studentId}
            />
          </label>

          <div className="md:col-span-2">
            <span className="text-sm font-medium text-on-primary">Roster status</span>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {currentMemberOptions.map((option) => {
                const isActive = form.currentMember === option.value;

                return (
                  <button
                    key={option.title}
                    aria-pressed={isActive}
                    className={`rounded-[1.5rem] border p-4 text-left transition ${
                      isActive
                        ? 'border-accent bg-accent/12 shadow-sm text-on-primary'
                        : 'border-border bg-secondary hover:bg-accent/10'
                    }`}
                    onClick={() => handleFieldChange('currentMember', option.value)}
                    type="button"
                  >
                    <p className={`text-base font-semibold ${isActive ? 'text-on-primary' : 'text-on-secondary'}`}>{option.title}</p>
                    <p className={`mt-2 text-sm leading-6 ${isActive ? 'text-on-primary/80' : 'text-on-secondary/80'}`}>{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2">
            <PasswordField
              id="edit-student-password"
              label="New password"
              onChange={(value) => handleFieldChange('password', value)}
              placeholder="Leave blank to keep password"
              showPassword={showPassword}
              toggleShowPassword={() => setShowPassword((currentValue) => !currentValue)}
              value={form.password}
            />
          </div>

          <div className="md:col-span-2">
            <Button className="md:w-auto" disabled={isSaving} type="submit">
              {isSaving ? 'Saving Student...' : 'Save Student'}
            </Button>
          </div>
        </form>
      )}

      {status.message && <CardMessage tone={status.tone}>{status.message}</CardMessage>}
    </article>
  );
};

const StudentTimeLogsCard = ({
  cardClassName,
  error,
  isLoading,
  students,
}) => {
  const sortedStudents = useMemo(() => sortStudentsByName(students), [students]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [logs, setLogs] = useState([]);
  const [logForms, setLogForms] = useState({});
  const [pageIndex, setPageIndex] = useState(0);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [savingLogId, setSavingLogId] = useState('');
  const [status, setStatus] = useState({ message: '', tone: 'muted' });

  const selectedStudent = useMemo(
    () => sortedStudents.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, sortedStudents],
  );

  const totalPages = Math.max(1, Math.ceil(logs.length / timeLogsPageSize));
  const visibleLogs = logs.slice(
    pageIndex * timeLogsPageSize,
    pageIndex * timeLogsPageSize + timeLogsPageSize,
  );
  const firstVisibleLogNumber = logs.length === 0 ? 0 : pageIndex * timeLogsPageSize + 1;
  const lastVisibleLogNumber = Math.min(logs.length, pageIndex * timeLogsPageSize + visibleLogs.length);

  const loadLogs = useCallback(async (student) => {
    if (!student) {
      setLogs([]);
      setLogForms({});
      return;
    }

    setIsLoadingLogs(true);
    setStatus({ message: '', tone: 'muted' });

    try {
      const studentLogs = await listTimeLogsForStudent({ student });

      setLogs(studentLogs);
      setLogForms(Object.fromEntries(
        studentLogs.map((log) => [log.id, buildTimeLogForm(log)]),
      ));
      setPageIndex(0);
    } catch (loadError) {
      setLogs([]);
      setLogForms({});
      setStatus({
        message: loadError?.message || 'Failed to load student logs.',
        tone: 'error',
      });
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (sortedStudents.length === 0) {
      setSelectedStudentId('');
      return;
    }

    const selectedStudentStillExists = sortedStudents.some((student) => student.id === selectedStudentId);

    if (!selectedStudentStillExists) {
      setSelectedStudentId(sortedStudents[0].id);
    }
  }, [selectedStudentId, sortedStudents]);

  useEffect(() => {
    loadLogs(selectedStudent);
  }, [loadLogs, selectedStudent]);

  useEffect(() => {
    if (pageIndex >= totalPages) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalPages]);

  const handleLogFieldChange = (logId, field, value) => {
    setLogForms((currentForms) => ({
      ...currentForms,
      [logId]: {
        ...currentForms[logId],
        [field]: value,
      },
    }));
    setStatus({ message: '', tone: 'muted' });
  };

  const handleLogSave = async (log) => {
    const form = logForms[log.id];

    if (!form) {
      return;
    }

    setSavingLogId(log.id);
    setStatus({ message: '', tone: 'muted' });

    try {
      await updateTimeLogByCoach({
        signInAt: form.signInAt,
        signInNotes: form.signInNotes,
        signOutAt: form.signOutAt,
        signOutNotes: form.signOutNotes,
        student: selectedStudent,
        taskName: form.taskName,
        timeLogId: log.id,
      });
      await loadLogs(selectedStudent);
      setStatus({ message: 'Time log saved.', tone: 'muted' });
    } catch (saveError) {
      setStatus({
        message: saveError?.message || 'Failed to save the time log.',
        tone: 'error',
      });
    } finally {
      setSavingLogId('');
    }
  };

  return (
    <article className={cardClassName}>
      <div className="border-b border-border pb-5">
        <h3 className="text-lg font-semibold text-on-primary">Student Time Logs</h3>
        <p className="mt-2 text-sm leading-6 text-on-primary/80">
          Select a student, review their logs, and correct times, notes, or task names.
        </p>
      </div>

      {isLoading ? (
        <CardMessage>Loading students...</CardMessage>
      ) : error ? (
        <CardMessage tone="error">{error}</CardMessage>
      ) : sortedStudents.length === 0 ? (
        <CardMessage>No students found.</CardMessage>
      ) : (
        <div className="mt-5 space-y-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Student</span>
            <select
              className={inputClassName}
              onChange={(event) => {
                setSelectedStudentId(event.target.value);
                setStatus({ message: '', tone: 'muted' });
              }}
              value={selectedStudentId}
            >
              {sortedStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {getStudentName(student)} ({getStudentId(student) || 'No ID'})
                </option>
              ))}
            </select>
          </label>

          {isLoadingLogs ? (
            <CardMessage>Loading student logs...</CardMessage>
          ) : logs.length === 0 ? (
            <CardMessage>No logs found for this student.</CardMessage>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-on-secondary sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {firstVisibleLogNumber}-{lastVisibleLogNumber} of {logs.length} logs
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-xl border border-border bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={pageIndex === 0}
                    onClick={() => setPageIndex((currentPage) => Math.max(0, currentPage - 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="rounded-xl border border-border bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={pageIndex >= totalPages - 1}
                    onClick={() => setPageIndex((currentPage) => Math.min(totalPages - 1, currentPage + 1))}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                {visibleLogs.map((log) => {
                  const form = logForms[log.id] ?? buildTimeLogForm(log);
                  const durationMinutes = getDurationMinutes(log);
                  const statusLabel = log[timeLogConfig.statusField] === timeLogConfig.activeStatus
                    ? 'Active'
                    : 'Completed';

                  return (
                    <section
                      className="rounded-[1.75rem] border border-on-primary/15 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--app-primary)_88%,transparent)_0%,color-mix(in_oklab,var(--app-primary)_72%,var(--app-accent))_58%,color-mix(in_oklab,var(--app-accent)_72%,transparent)_100%)] p-4 shadow-lg shadow-primary/15 backdrop-blur-sm"
                      key={log.id}
                    >
                      <div className="flex flex-col gap-2 border-b border-on-primary/15 pb-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-on-primary">{formatTaskName(form.taskName, 'Task')}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-on-primary/70">
                            {statusLabel}
                            {durationMinutes > 0 ? ` - ${minutesToHours(durationMinutes).toFixed(1)} hours` : ''}
                          </p>
                        </div>
                        <Button
                          className="sm:w-auto"
                          disabled={savingLogId === log.id}
                          onClick={() => handleLogSave(log)}
                          type="button"
                        >
                          {savingLogId === log.id ? 'Saving...' : 'Save Log'}
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-sm font-medium text-on-primary">Task name</span>
                          <input
                            className={inputClassName}
                            onChange={(event) => handleLogFieldChange(log.id, 'taskName', event.target.value)}
                            type="text"
                            value={form.taskName}
                          />
                        </label>

                        <label className="flex flex-col gap-1.5">
                          <span className="text-sm font-medium text-on-primary">Start time</span>
                          <input
                            className={inputClassName}
                            onChange={(event) => handleLogFieldChange(log.id, 'signInAt', event.target.value)}
                            type="datetime-local"
                            value={form.signInAt}
                          />
                        </label>

                        <label className="flex flex-col gap-1.5">
                          <span className="text-sm font-medium text-on-primary">End time</span>
                          <input
                            className={inputClassName}
                            onChange={(event) => handleLogFieldChange(log.id, 'signOutAt', event.target.value)}
                            type="datetime-local"
                            value={form.signOutAt}
                          />
                        </label>

                        <label className="flex flex-col gap-1.5 md:row-span-2">
                          <span className="text-sm font-medium text-on-primary">Sign-in notes</span>
                          <textarea
                            className="min-h-28 w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-on-secondary outline-none transition placeholder:text-on-secondary/70 focus:border-primary focus:ring-4 focus:ring-primary/15"
                            onChange={(event) => handleLogFieldChange(log.id, 'signInNotes', event.target.value)}
                            value={form.signInNotes}
                          />
                        </label>

                        <label className="flex flex-col gap-1.5 md:row-span-2">
                          <span className="text-sm font-medium text-on-primary">Sign-out notes</span>
                          <textarea
                            className="min-h-28 w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-on-secondary outline-none transition placeholder:text-on-secondary/70 focus:border-primary focus:ring-4 focus:ring-primary/15"
                            onChange={(event) => handleLogFieldChange(log.id, 'signOutNotes', event.target.value)}
                            value={form.signOutNotes}
                          />
                        </label>
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {status.message && <CardMessage tone={status.tone}>{status.message}</CardMessage>}
    </article>
  );
};

const StudentManagementDashboard = ({ cardClassName = defaultCardClassName }) => {
  const { coachUser } = useAuth();
  const { students, isLoading: isLoadingStudents, error: studentsError } = useStudents();
  const { tasks, isLoading: isLoadingTasks, error: tasksError } = useTasks();
  const { schedules, isLoading: isLoadingSchedules, error: schedulesError } = useSchedules();
  const { logs, isLoading: isLoadingLogs, error: logsError } = useCompletedTimeLogs();
  const enteredBy = coachUser?.email ?? coachUser?.displayName ?? 'Coach';

  const signInTasks = useMemo(
    () => getAvailableSignInTasks(tasks, schedules),
    [schedules, tasks],
  );
  const rosterStudents = useMemo(() => {
    const totalsByStudent = buildStudentHourTotals(logs);

    return sortStudentsByName(students)
      .filter(getCurrentMemberValue)
      .map((student) => {
        const totalMinutes = getStudentTotalMinutes(student, totalsByStudent);

        return {
          ...student,
          totalHours: minutesToHours(totalMinutes),
          totalMinutes,
        };
      });
  }, [logs, students]);
  const totalRosterHours = useMemo(
    () => minutesToHours(rosterStudents.reduce((sum, student) => sum + student.totalMinutes, 0)),
    [rosterStudents],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CreateStudentCard cardClassName={cardClassName} />
        <ActiveRosterCard
          cardClassName={cardClassName}
          error={studentsError || logsError}
          isLoading={isLoadingStudents || isLoadingLogs}
          rosterStudents={rosterStudents}
          totalRosterHours={totalRosterHours}
        />
        <SignInStudentCard
          cardClassName={cardClassName}
          error={studentsError || tasksError || schedulesError}
          isLoading={isLoadingStudents || isLoadingTasks || isLoadingSchedules}
          students={students}
          tasks={signInTasks}
        />
        <ExtraHoursCard
          cardClassName={cardClassName}
          enteredBy={enteredBy}
          error={studentsError}
          isLoading={isLoadingStudents}
          students={students}
        />
      </div>

      <EditStudentCard
        cardClassName={cardClassName}
        error={studentsError}
        isLoading={isLoadingStudents}
        students={students}
      />

      <StudentTimeLogsCard
        cardClassName={cardClassName}
        error={studentsError}
        isLoading={isLoadingStudents}
        students={students}
      />
    </div>
  );
};

export default StudentManagementDashboard;
