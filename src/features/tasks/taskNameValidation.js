export const MAX_TASK_NAME_LENGTH = 120;

const disallowedTaskNameCharacters = /[\u0000-\u001F\u007F-\u009F\u061C\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;

const getReservedTaskNameKey = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

export const isReservedTaskName = (value) => {
  const taskNameKey = getReservedTaskNameKey(value);

  return taskNameKey === 'extrahours' || taskNameKey === 'extratime';
};

export const validateTaskName = (value) => {
  const taskName = String(value ?? '').normalize('NFC').trim();

  if (!taskName) {
    throw new Error('A task name is required.');
  }

  if (taskName.length > MAX_TASK_NAME_LENGTH) {
    throw new Error(`Task names must be ${MAX_TASK_NAME_LENGTH} characters or fewer.`);
  }

  if (disallowedTaskNameCharacters.test(taskName)) {
    throw new Error('Task names cannot contain control or invisible formatting characters.');
  }

  if (isReservedTaskName(taskName)) {
    throw new Error('This task name is reserved for system-managed extra hours.');
  }

  return taskName;
};
