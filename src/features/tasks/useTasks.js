import { useEffect, useState } from 'react';
import { listTasks } from './taskService';

const taskCache = {
  error: '',
  hasLoaded: false,
  promise: null,
  tasks: [],
};

const loadCachedTasks = async ({ force = false } = {}) => {
  if (!force && taskCache.hasLoaded) {
    return taskCache.tasks;
  }

  if (!force && taskCache.promise) {
    return taskCache.promise;
  }

  taskCache.promise = listTasks()
    .then((loadedTasks) => {
      taskCache.error = '';
      taskCache.hasLoaded = true;
      taskCache.tasks = loadedTasks;
      return loadedTasks;
    })
    .catch((loadError) => {
      taskCache.error = loadError.message || 'Failed to load tasks.';
      throw loadError;
    })
    .finally(() => {
      taskCache.promise = null;
    });

  return taskCache.promise;
};

export const useTasks = ({ enabled = true } = {}) => {
  const [tasks, setTasks] = useState(() => taskCache.tasks);
  const [isLoading, setIsLoading] = useState(() => enabled && !taskCache.hasLoaded);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Ignore results from requests that finish after this hook unmounts.
    let isMounted = true;

    if (!enabled) {
      setTasks(taskCache.tasks);
      setIsLoading(false);
      setError(taskCache.error);
      return () => {
        isMounted = false;
      };
    }

    const loadTasks = async () => {
      setTasks(taskCache.tasks);
      setIsLoading(!taskCache.hasLoaded);
      setError('');

      try {
        const allTasks = await loadCachedTasks({ force: reloadToken > 0 });

        if (isMounted) {
          setTasks(allTasks);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Failed to load tasks.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTasks();

    return () => {
      isMounted = false;
    };
  }, [enabled, reloadToken]);

  return {
    tasks,
    isLoading,
    error,
    // Changing this internal value is a simple way for callers to request a
    // fresh Firestore read after creating a task.
    reloadTasks: () => setReloadToken((currentValue) => currentValue + 1),
  };
};
