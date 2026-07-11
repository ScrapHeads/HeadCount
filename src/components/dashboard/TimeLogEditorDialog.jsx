import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { timeLogConfig } from '../../config/appConfig';
import { updateTimeLogByCoach } from '../../features/timeLogs/timeLogService';
import { formatTaskName, isExtraHoursTaskName } from '../../lib/analyticsUtils';
import { toDate } from '../../lib/dateUtils';
import {
  DASHBOARD_GRADIENT_CLASS_NAME,
  FORM_INPUT_CLASS_NAME,
  FORM_TEXTAREA_CLASS_NAME,
} from '../../styles/classNames';
import Button from '../shared/Button';

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

const TimeLogEditorDialog = ({
  log,
  onClose,
  onSaved,
  student,
  studentName = 'Student',
}) => {
  const [form, setForm] = useState(() => buildTimeLogForm(log));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(buildTimeLogForm(log));
    setError('');
  }, [log]);

  if (!log || typeof document === 'undefined') {
    return null;
  }

  const handleFieldChange = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setError('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      await updateTimeLogByCoach({
        signInAt: form.signInAt,
        signInNotes: form.signInNotes,
        signOutAt: form.signOutAt,
        signOutNotes: form.signOutNotes,
        student,
        taskName: form.taskName,
        timeLogId: log.id,
      });
      await onSaved?.();
      onClose();
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save the time log.');
    } finally {
      setIsSaving(false);
    }
  };

  // Rendering at document.body keeps the modal above dashboard containers
  // that use scrolling or overflow clipping.
  return createPortal(
    <div
      aria-labelledby="time-log-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className={`max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-on-primary/15 ${DASHBOARD_GRADIENT_CLASS_NAME} p-6 shadow-2xl shadow-primary/20`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-on-primary" id="time-log-dialog-title">
              {formatTaskName(form.taskName, 'Task')}
            </h3>
            <p className="mt-1 text-sm text-on-primary/90">{studentName}</p>
          </div>
          <button
            aria-label="Close time log editor"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-on-primary/90 transition hover:bg-accent/20"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-sm font-medium text-on-primary">Task name</span>
            <input
              className={FORM_INPUT_CLASS_NAME}
              onChange={(event) => handleFieldChange('taskName', event.target.value)}
              type="text"
              value={form.taskName}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Start time</span>
            <input
              className={FORM_INPUT_CLASS_NAME}
              onChange={(event) => handleFieldChange('signInAt', event.target.value)}
              type="datetime-local"
              value={form.signInAt}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">End time</span>
            <input
              className={FORM_INPUT_CLASS_NAME}
              onChange={(event) => handleFieldChange('signOutAt', event.target.value)}
              type="datetime-local"
              value={form.signOutAt}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Sign-in notes</span>
            <textarea
              className={`${FORM_TEXTAREA_CLASS_NAME} min-h-28`}
              onChange={(event) => handleFieldChange('signInNotes', event.target.value)}
              value={form.signInNotes}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-primary">Sign-out notes</span>
            <textarea
              className={`${FORM_TEXTAREA_CLASS_NAME} min-h-28`}
              onChange={(event) => handleFieldChange('signOutNotes', event.target.value)}
              value={form.signOutNotes}
            />
          </label>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-300/40 bg-red-950/20 px-4 py-3 text-sm text-on-primary">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-on-primary transition hover:bg-accent/10"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <Button
            className="sm:w-auto"
            disabled={isSaving}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? 'Saving...' : 'Save Log'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TimeLogEditorDialog;
