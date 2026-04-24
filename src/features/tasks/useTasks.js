import { useEffect, useState } from 'react';
import { listTasks } from './taskService';

export const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
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
  }, []);

  return { tasks, isLoading, error };
};
