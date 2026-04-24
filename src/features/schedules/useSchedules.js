import { useEffect, useState } from 'react';
import { listSchedules, listSchedulesForTask } from './scheduleService';

export const useSchedules = (taskId) => {
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadSchedules = async () => {
      setIsLoading(true);
      setError('');

      try {
        const taskSchedules = taskId
          ? await listSchedulesForTask(taskId)
          : await listSchedules();

        if (isMounted) {
          setSchedules(taskSchedules);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Failed to load schedules.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSchedules();

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  return { schedules, isLoading, error };
};
