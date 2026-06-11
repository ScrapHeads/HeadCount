import { useEffect, useState } from 'react';
import { watchCompletedTimeLogs } from './timeLogService';

export const useCompletedTimeLogs = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setIsLoading(true);
    setError('');

    const unsubscribe = watchCompletedTimeLogs(
      (completedLogs) => {
        setLogs(completedLogs);
        setIsLoading(false);
      },
      (loadError) => {
        setLogs([]);
        setError(loadError?.message || 'Failed to load completed time logs.');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  return {
    logs,
    isLoading,
    error,
  };
};
