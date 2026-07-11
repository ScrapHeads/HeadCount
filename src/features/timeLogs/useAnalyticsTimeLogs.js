import { useEffect, useState } from 'react';
import { listAnalyticsTimeLogsByRange } from './timeLogService';

const analyticsLogCaches = new Map();

const getAnalyticsCacheKey = ({ endTime, startTime }) => `${startTime}:${endTime}`;

const getAnalyticsLogCache = ({ endTime, startTime }) => {
  const cacheKey = getAnalyticsCacheKey({ endTime, startTime });

  if (!analyticsLogCaches.has(cacheKey)) {
    analyticsLogCaches.set(cacheKey, {
      error: '',
      hasLoaded: false,
      logs: [],
      promise: null,
    });
  }

  return analyticsLogCaches.get(cacheKey);
};

const loadCachedAnalyticsLogs = async ({
  endTime,
  force = false,
  startTime,
}) => {
  const cache = getAnalyticsLogCache({ endTime, startTime });

  if (!force && cache.hasLoaded) {
    return cache.logs;
  }

  if (!force && cache.promise) {
    return cache.promise;
  }

  cache.promise = listAnalyticsTimeLogsByRange({
    startDate: new Date(startTime),
    endDate: new Date(endTime),
  })
    .then((timeLogs) => {
      cache.error = '';
      cache.hasLoaded = true;
      cache.logs = timeLogs;
      return timeLogs;
    })
    .catch((loadError) => {
      cache.error = loadError?.message || 'Failed to load analytics time logs.';
      throw loadError;
    })
    .finally(() => {
      cache.promise = null;
    });

  return cache.promise;
};

export const useAnalyticsTimeLogs = ({ startDate, endDate, enabled = true }) => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const startTime = startDate?.getTime() ?? null;
  const endTime = endDate?.getTime() ?? null;

  useEffect(() => {
    // Incrementing reloadToken re-runs this effect after a coach edits a log,
    // without making the token part of the data returned to the UI.
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
      const currentCache = getAnalyticsLogCache({ endTime, startTime });

      setLogs(currentCache.logs);
      setIsLoading(!currentCache.hasLoaded);
      setError('');

      try {
        const timeLogs = await loadCachedAnalyticsLogs({
          endTime,
          force: reloadToken > 0,
          startTime,
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
