import { useEffect, useState } from 'react';
import { listTasks } from './taskService';

export const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Ignore results from requests that finish after this hook unmounts.
    let isMounted = true;

    const loadTasks = async () => {
      setIsLoading(true);
      setError('');

      try {
        const allTasks = await listTasks();

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
  }, [reloadToken]);

  return {
    tasks,
    isLoading,
    error,
    // Changing this internal value is a simple way for callers to request a
    // fresh Firestore read after creating a task.
    reloadTasks: () => setReloadToken((currentValue) => currentValue + 1),
  };
};
