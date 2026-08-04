import { useState } from 'react';
import { taskConfig } from '../../config/appConfig';
import {
  createTask,
  setTaskScheduled,
} from '../../features/tasks/taskService';
import { MAX_TASK_NAME_LENGTH } from '../../features/tasks/taskNameValidation';
import { FORM_INPUT_CLASS_NAME } from '../../styles/classNames';
import Button from '../shared/Button';

const availabilityOptions = [
  {
    description: 'Students can select this task at any time.',
    scheduled: false,
    title: 'Always available',
  },
  {
    description: 'Students see this task only during one of its meeting windows.',
    scheduled: true,
    title: 'Schedule only',
  },
];

const TaskAvailabilityCard = ({
  cardClassName,
  error = '',
  isLoading = false,
  onTasksChanged,
  tasks = [],
}) => {
  const [taskName, setTaskName] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isTaskListExpanded, setIsTaskListExpanded] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleCreateTask = async (event) => {
    event.preventDefault();
    setIsCreating(true);
    setStatusMessage('');

    try {
      await createTask({
        name: taskName,
        scheduled: isScheduled,
      });
      await onTasksChanged?.();
      setTaskName('');
      setIsScheduled(false);
      setStatusMessage(
        isScheduled
          ? 'Schedule-controlled task created.'
          : 'Always-available task created.',
      );
    } catch (createError) {
      setStatusMessage(createError?.message || 'Failed to create the task.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAvailabilityChange = async (task, scheduled) => {
    setUpdatingTaskId(task.id);
    setStatusMessage('');

    try {
      await setTaskScheduled(task.id, scheduled);
      await onTasksChanged?.();
      setStatusMessage(
        scheduled
          ? `${task[taskConfig.nameField]} now follows its meeting schedule.`
          : `${task[taskConfig.nameField]} is now always available.`,
      );
    } catch (updateError) {
      setStatusMessage(updateError?.message || 'Failed to update task availability.');
    } finally {
      setUpdatingTaskId('');
    }
  };

  return (
    <article className={cardClassName}>
      <div className="border-b border-border pb-5">
        <p className="text-lg font-semibold text-on-primary">Task availability</p>
        <p className="mt-2 leading-6 text-on-primary/90">
          Create tasks and choose whether students always see them or only see them during a scheduled meeting.
        </p>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={handleCreateTask}>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">Task name</span>
          <input
            className={FORM_INPUT_CLASS_NAME}
            maxLength={MAX_TASK_NAME_LENGTH}
            onChange={(event) => {
              setTaskName(event.target.value);
              setStatusMessage('');
            }}
            placeholder="Example: Shop work"
            required
            type="text"
            value={taskName}
          />
        </label>

        <div>
          <span className="text-sm font-medium text-on-primary">Student availability</span>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {availabilityOptions.map((option) => {
              const isActive = isScheduled === option.scheduled;

              return (
                <button
                  aria-pressed={isActive}
                  className={`rounded-[1.5rem] border p-4 text-left transition ${
                    isActive
                      ? 'border-accent bg-accent/12'
                      : 'border-border bg-secondary hover:bg-accent/10'
                  }`}
                  key={option.title}
                  onClick={() => {
                    setIsScheduled(option.scheduled);
                    setStatusMessage('');
                  }}
                  type="button"
                >
                  <span className={`block font-semibold ${
                    isActive ? 'text-on-primary' : 'text-on-secondary'
                  }`}>
                    {option.title}
                  </span>
                  <span className={`mt-2 block text-sm leading-6 ${
                    isActive ? 'text-on-primary/85' : 'text-on-secondary/85'
                  }`}>
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Button
          className="md:w-fit"
          disabled={isCreating}
          type="submit"
        >
          {isCreating ? 'Creating task...' : 'Create task'}
        </Button>
      </form>

      {(statusMessage || error) && (
        <p className="mt-5 rounded-xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
          {statusMessage || error}
        </p>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-on-primary/80">
            Existing tasks{isLoading ? '' : ` (${tasks.length})`}
          </p>
          <button
            aria-expanded={isTaskListExpanded}
            className="rounded-xl border border-border bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary transition hover:opacity-90"
            onClick={() => setIsTaskListExpanded((currentValue) => !currentValue)}
            type="button"
          >
            {isTaskListExpanded ? 'Minimize' : 'Expand'}
          </button>
        </div>

        {isTaskListExpanded && (
          isLoading ? (
            <p className="mt-4 text-sm text-on-primary/80">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="mt-4 text-sm text-on-primary/80">No tasks have been created.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {tasks.map((task) => {
                const scheduled = Boolean(task[taskConfig.scheduledField]);
                const isUpdating = updatingTaskId === task.id;

                return (
                  <div
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-primary/25 p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={task.id}
                  >
                    <div>
                      <p className="font-semibold text-on-primary">
                        {task[taskConfig.nameField] ?? 'Task'}
                      </p>
                      <p className="mt-1 text-sm text-on-primary/75">
                        {scheduled ? 'Visible during meetings only' : 'Always visible on sign-in'}
                      </p>
                    </div>
                    <button
                      className="shrink-0 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-on-secondary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={Boolean(updatingTaskId)}
                      onClick={() => handleAvailabilityChange(task, !scheduled)}
                      type="button"
                    >
                      {isUpdating
                        ? 'Updating...'
                        : scheduled
                          ? 'Make always available'
                          : 'Use meeting schedule'}
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </article>
  );
};

export default TaskAvailabilityCard;
