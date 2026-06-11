import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  extraTimeRequestConfig,
  scheduleConfig,
  studentAuthConfig,
  taskConfig,
  timeLogConfig,
} from '../../config/appConfig';
import { useAuth } from '../../features/auth/useAuth.jsx';
import { reviewExtraTimeRequest } from '../../features/extraTimeRequests/extraTimeRequestService';
import { useExtraTimeRequests } from '../../features/extraTimeRequests/useExtraTimeRequests';
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
} from '../../features/timeLogs/timeLogService';
import {
  formatTaskName,
  getDurationMinutes,
  isCompletedLog,
  minutesToHours,
} from '../../lib/analyticsUtils';
import { toDate } from '../../lib/dateUtils';
import {
  DASHBOARD_CARD_CLASS_NAME,
  DASHBOARD_TABLE_HEADER_CLASS_NAME,
  FORM_INPUT_CLASS_NAME,
  FORM_TEXTAREA_CLASS_NAME,
} from '../../styles/classNames';
import Button from '../shared/Button';
import Dropdown from '../shared/Dropdown';
import TimeLogEditorDialog from './TimeLogEditorDialog';

const tableCellClassName = 'border-y border-border bg-transparent px-4 py-3 text-sm text-on-primary';
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

const formatLogDateTime = (value) => {
  const date = toDate(value);

  if (!date) return '-';

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

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
        : 'border-border bg-accent/10 text-on-primary/90'
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
        className={`${FORM_INPUT_CLASS_NAME} pr-20`}
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

const StudentDropdown = ({
  className = '',
  label = 'Student',
  onChange,
  students,
  value,
}) => (
  <Dropdown
    className={className}
    label={label}
    onChange={onChange}
    options={students.map((student) => ({
      label: `${getStudentName(student)} (${getStudentId(student) || 'No ID'})`,
      value: student.id,
    }))}
    placeholder="Select a student"
    value={value}
  />
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
        <p className="mt-2 text-sm leading-6 text-on-primary/90">
          Adds the student to Firestore and creates their Firebase Authentication sign-in.
        </p>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">Name</span>
          <input
            className={FORM_INPUT_CLASS_NAME}
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
            className={FORM_INPUT_CLASS_NAME}
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

        <fieldset className="flex flex-col gap-1.5 space-y-1.5">
          <legend className="text-sm font-medium text-on-primary">Membership Status</legend>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-transparent p-1">
            {currentMemberOptions.map((option) => {
              const isSelected = form.currentMember === option.value;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
                    isSelected
                      ? 'bg-secondary text-on-secondary shadow-sm'
                      : 'bg-transparent text-on-primary/90 hover:bg-secondary/20'
                  }`}
                  key={String(option.value)}
                  onClick={() => handleFieldChange('currentMember', option.value)}
                  type="button"
                >
                  {option.title}
                </button>
              );
            })}
          </div>
        </fieldset>

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
      <p className="mt-2 text-sm leading-6 text-on-primary/90">
        Current members with their all-time completed hours.
      </p>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="flex min-h-[104px] flex-col items-center justify-center rounded-2xl border border-border bg-secondary px-4 py-4 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-secondary/90">Current Members</p>
        <p className="mt-2 text-2xl font-semibold text-on-secondary">{rosterStudents.length}</p>
      </div>
      <div className="flex min-h-[104px] flex-col items-center justify-center rounded-2xl border border-border bg-secondary px-4 py-4 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-secondary/90">Total Hours</p>
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
              <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Name</th>
              <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Student ID</th>
              <th className={`${DASHBOARD_TABLE_HEADER_CLASS_NAME} text-right`}>Total Hours</th>
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
        <p className="mt-2 text-sm leading-6 text-on-primary/90">
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
          <StudentDropdown
            onChange={(studentId) => {
              setSelectedStudentId(studentId);
              clearStatus();
            }}
            students={availableStudents}
            value={selectedStudentId}
          />

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
                      <span className={`mt-1 block text-sm ${isActive ? 'text-on-primary/90' : 'text-on-secondary'}`}>
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
              className={`${FORM_TEXTAREA_CLASS_NAME} min-h-28`}
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
        <p className="mt-2 text-sm leading-6 text-on-primary/90">
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
          <StudentDropdown
            onChange={(studentId) => {
              setSelectedStudentId(studentId);
              clearStatus();
            }}
            students={sortedStudents}
            value={selectedStudentId}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Hours</span>
            <input
              className={FORM_INPUT_CLASS_NAME}
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
              className={`${FORM_TEXTAREA_CLASS_NAME} min-h-28`}
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

const ExtraTimeRequestsCard = ({ cardClassName, reviewedBy }) => {
  const { requests, isLoading, error } = useExtraTimeRequests();
  const [reviewingRequestId, setReviewingRequestId] = useState('');
  const [status, setStatus] = useState({ message: '', tone: 'muted' });
  const pendingRequests = useMemo(
    () => requests.filter((request) => (
      request[extraTimeRequestConfig.statusField] === extraTimeRequestConfig.pendingStatus
    )),
    [requests],
  );

  const handleReview = async (request, decision) => {
    setReviewingRequestId(request.id);
    setStatus({ message: '', tone: 'muted' });

    try {
      await reviewExtraTimeRequest({
        decision,
        request,
        reviewedBy,
      });
      setStatus({
        message: decision === extraTimeRequestConfig.approvedStatus
          ? `Approved extra time for ${request[extraTimeRequestConfig.studentNameField]}.`
          : `Denied extra time for ${request[extraTimeRequestConfig.studentNameField]}.`,
        tone: 'muted',
      });
    } catch (reviewError) {
      setStatus({
        message: reviewError?.message || 'Failed to review the extra-time request.',
        tone: 'error',
      });
    } finally {
      setReviewingRequestId('');
    }
  };

  return (
    <article className={cardClassName}>
      <div className="border-b border-border pb-5">
        <h3 className="text-lg font-semibold text-on-primary">Extra Time Requests</h3>
        <p className="mt-2 text-sm leading-6 text-on-primary/90">
          Approve requests to create completed Extra Hours logs, or deny them without adding hours.
        </p>
      </div>

      {isLoading ? (
        <CardMessage>Loading extra-time requests...</CardMessage>
      ) : error ? (
        <CardMessage tone="error">{error}</CardMessage>
      ) : pendingRequests.length === 0 ? (
        <CardMessage>No pending extra-time requests.</CardMessage>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3 text-center">
            <thead>
              <tr>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Student</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Hours</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Reason</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((request) => {
                const isReviewing = reviewingRequestId === request.id;
                const requestHours = minutesToHours(
                  request[extraTimeRequestConfig.durationMinutesField],
                ).toFixed(2);

                return (
                  <tr key={request.id}>
                    <td className="rounded-l-2xl border-y border-l border-border bg-transparent px-4 py-4 text-center text-sm text-on-primary">
                      <span className="font-semibold">
                        {request[extraTimeRequestConfig.studentNameField] ?? 'Student'}
                      </span>
                      <span className="mt-1 block text-xs text-on-primary/80">
                        {request[extraTimeRequestConfig.studentIdField] ?? 'ID not set'}
                      </span>
                    </td>
                    <td className={tableCellClassName}>{requestHours}</td>
                    <td className={`${tableCellClassName} text-center`}>
                      {request[extraTimeRequestConfig.reasonField]}
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-border bg-transparent px-4 py-4 text-center">
                      <div className="inline-flex flex-nowrap items-center justify-center gap-2">
                        <button
                          className="rounded-xl border border-border bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isReviewing}
                          onClick={() => handleReview(
                            request,
                            extraTimeRequestConfig.deniedStatus,
                          )}
                          type="button"
                        >
                          Deny
                        </button>
                        <Button
                          className="w-auto whitespace-nowrap"
                          disabled={isReviewing}
                          onClick={() => handleReview(
                            request,
                            extraTimeRequestConfig.approvedStatus,
                          )}
                          type="button"
                        >
                          {isReviewing ? 'Reviewing...' : 'Approve'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
        <p className="mt-2 text-sm leading-6 text-on-primary/90">
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
          <StudentDropdown
            className="md:col-span-2"
            onChange={(studentId) => {
              setSelectedStudentId(studentId);
              setStatus({ message: '', tone: 'muted' });
            }}
            students={sortedStudents}
            value={selectedStudentId}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Name</span>
            <input
              className={FORM_INPUT_CLASS_NAME}
              onChange={(event) => handleFieldChange('name', event.target.value)}
              required
              type="text"
              value={form.name}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Student ID</span>
            <input
              className={FORM_INPUT_CLASS_NAME}
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
                    <p className={`mt-2 text-sm leading-6 ${isActive ? 'text-on-primary/90' : 'text-on-secondary/90'}`}>{option.description}</p>
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
  const [pageIndex, setPageIndex] = useState(0);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [status, setStatus] = useState({ message: '', tone: 'muted' });
  const [selectedLogId, setSelectedLogId] = useState(null);

  const selectedStudent = useMemo(
    () => sortedStudents.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, sortedStudents],
  );
  const selectedLog = useMemo(
    () => logs.find((log) => log.id === selectedLogId) ?? null,
    [logs, selectedLogId],
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
      return;
    }

    setIsLoadingLogs(true);
    setStatus({ message: '', tone: 'muted' });

    try {
      const studentLogs = await listTimeLogsForStudent({ student });

      setLogs(studentLogs);
      setPageIndex(0);
    } catch (loadError) {
      setLogs([]);
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

  return (
    <article className={cardClassName}>
      <div className="border-b border-border pb-5">
        <h3 className="text-lg font-semibold text-on-primary">Student Time Logs</h3>
        <p className="mt-2 text-sm leading-6 text-on-primary/90">
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
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-transparent px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
            <StudentDropdown
              className="min-w-0 flex-1 max-w-md"
              onChange={(studentId) => {
                setSelectedStudentId(studentId);
                setSelectedLogId(null);
                setStatus({ message: '', tone: 'muted' });
              }}
              students={sortedStudents}
              value={selectedStudentId}
            />

            {!isLoadingLogs && logs.length > 0 && (
              <div className="flex flex-col gap-3 text-sm text-on-primary sm:flex-row sm:items-center">
                <span className="whitespace-nowrap">
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
            )}
          </div>

          {isLoadingLogs ? (
            <CardMessage>Loading student logs...</CardMessage>
          ) : logs.length === 0 ? (
            <CardMessage>No logs found for this student.</CardMessage>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr>
                      <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Task</th>
                      <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Status</th>
                      <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Start</th>
                      <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>End</th>
                      <th className={`${DASHBOARD_TABLE_HEADER_CLASS_NAME} text-right`}>Hours</th>
                      <th className={`${DASHBOARD_TABLE_HEADER_CLASS_NAME} text-right`}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLogs.map((log) => {
                      const durationMinutes = getDurationMinutes(log);
                      const isActive = log[timeLogConfig.statusField] === timeLogConfig.activeStatus;

                      return (
                        <tr key={log.id}>
                          <td className="rounded-l-2xl border-y border-l border-border bg-transparent px-4 py-4 text-sm text-on-primary">
                            <span className="font-semibold">
                              {formatTaskName(log[timeLogConfig.taskNameField], 'Task')}
                            </span>
                          </td>
                          <td className={tableCellClassName}>{isActive ? 'Active' : 'Completed'}</td>
                          <td className={`${tableCellClassName} whitespace-nowrap`}>
                            {formatLogDateTime(log[timeLogConfig.signInAtField])}
                          </td>
                          <td className={`${tableCellClassName} whitespace-nowrap`}>
                            {formatLogDateTime(log[timeLogConfig.signOutAtField])}
                          </td>
                          <td className={`${tableCellClassName} text-right font-semibold`}>
                            {minutesToHours(durationMinutes).toFixed(2)}
                          </td>
                          <td className="rounded-r-2xl border-y border-r border-border bg-transparent px-4 py-4 text-right">
                            <button
                              className="inline-flex items-center justify-center bg-secondary rounded-xl border border-border px-4 py-2 text-sm font-semibold text-on-secondary transition hover:bg-accent/10"
                              onClick={() => setSelectedLogId(log.id)}
                              type="button"
                            >
                              Edit Log
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {status.message && <CardMessage tone={status.tone}>{status.message}</CardMessage>}

      {selectedLog && (
        <TimeLogEditorDialog
          log={selectedLog}
          onClose={() => setSelectedLogId(null)}
          onSaved={async () => {
            await loadLogs(selectedStudent);
            setStatus({ message: 'Time log saved.', tone: 'muted' });
          }}
          student={selectedStudent}
          studentName={selectedStudent ? getStudentName(selectedStudent) : 'Student'}
        />
      )}
    </article>
  );
};

const StudentManagementDashboard = ({ cardClassName = DASHBOARD_CARD_CLASS_NAME }) => {
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
        <ExtraTimeRequestsCard
          cardClassName={`${cardClassName} xl:col-span-2`}
          reviewedBy={enteredBy}
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
