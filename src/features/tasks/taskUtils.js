import { scheduleConfig, taskConfig } from '../../config/appConfig';
import { isScheduleActive } from '../schedules/validateSchedule';

export const normalizeTaskRef = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

export const taskMatchesReference = (task, reference) => {
  const normalizedReference = normalizeTaskRef(reference);

  if (!normalizedReference) {
    return false;
  }

  // Older data sometimes stored a task name where newer data stores the
  // Firestore document ID. Matching both keeps those records usable.
  return (
    normalizeTaskRef(task.id) === normalizedReference
    || normalizeTaskRef(task[taskConfig.nameField]) === normalizedReference
  );
};

export const getAvailableSignInTasks = (
  tasks,
  schedules,
  currentTime = new Date(),
) => {
  const activeScheduledTaskIds = new Set();

  schedules
    .filter((schedule) => isScheduleActive(schedule, currentTime))
    .forEach((schedule) => {
      activeScheduledTaskIds.add(normalizeTaskRef(
        schedule[scheduleConfig.taskIdField],
      ));
    });

  // Unscheduled tasks are always available. Scheduled tasks appear only while
  // one of their schedule occurrences is active.
  return tasks.filter((task) => {
    if (!task[taskConfig.scheduledField]) {
      return true;
    }

    return (
      activeScheduledTaskIds.has(normalizeTaskRef(task.id))
      || activeScheduledTaskIds.has(normalizeTaskRef(task[taskConfig.nameField]))
    );
  });
};
