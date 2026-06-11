import { useEffect, useState } from 'react';
import { listTimeLogsBySignInRange } from './timeLogService';

export const useAnalyticsTimeLogs = ({ startDate, endDate, enabled = true }) => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const startTime = startDate?.getTime() ?? null;
  const endTime = endDate?.getTime() ?? null;

  useEffect(() => {
    let isMounted = true;

    if (!enabled || startTime === null || endTime === null) {
      setLogs([]);
      setIsLoading(false);
      setError('');
      return () => {
        isMounted = false;
      };
    }

    const loadTimeLogs = async () => {
      setIsLoading(true);
      setError('');

      try {
        const timeLogs = await listTimeLogsBySignInRange({
          startDate: new Date(startTime),
          endDate: new Date(endTime),
        });

        if (isMounted) {
          setLogs(timeLogs);
        }
      } catch (loadError) {
        if (isMounted) {
          setLogs([]);
          setError(loadError?.message || 'Failed to load analytics time logs.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTimeLogs();

    return () => {
      isMounted = false;
    };
  }, [enabled, endTime, reloadToken, startTime]);

  return {
    logs,
    isLoading,
    error,
    reloadLogs: () => setReloadToken((currentValue) => currentValue + 1),
  };
};
