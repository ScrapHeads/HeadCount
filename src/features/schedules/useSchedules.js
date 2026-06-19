import { useEffect, useState } from 'react';
import { listSchedules, listSchedulesForTask } from './scheduleService';

const allSchedulesCacheKey = '__all-schedules__';
const scheduleCaches = new Map();

const getScheduleCacheKey = (taskId) => taskId || allSchedulesCacheKey;

const getScheduleCache = (taskId) => {
  const cacheKey = getScheduleCacheKey(taskId);

  if (!scheduleCaches.has(cacheKey)) {
    scheduleCaches.set(cacheKey, {
      error: '',
      hasLoaded: false,
      promise: null,
      schedules: [],
    });
  }

  return scheduleCaches.get(cacheKey);
};

const loadCachedSchedules = async ({ force = false, taskId } = {}) => {
  const cache = getScheduleCache(taskId);

  if (!force && cache.hasLoaded) {
    return cache.schedules;
  }

  if (!force && cache.promise) {
    return cache.promise;
  }

  cache.promise = (taskId ? listSchedulesForTask(taskId) : listSchedules())
    .then((loadedSchedules) => {
      cache.error = '';
      cache.hasLoaded = true;
      cache.schedules = loadedSchedules;
      return loadedSchedules;
    })
    .catch((loadError) => {
      cache.error = loadError.message || 'Failed to load schedules.';
      throw loadError;
    })
    .finally(() => {
      cache.promise = null;
    });

  return cache.promise;
};

export const useSchedules = (taskId, { enabled = true } = {}) => {
  const cache = getScheduleCache(taskId);
  const [schedules, setSchedules] = useState(() => cache.schedules);
  const [isLoading, setIsLoading] = useState(() => enabled && !cache.hasLoaded);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Ignore results from an older task selection or an unmounted component.
    let isMounted = true;
    const currentCache = getScheduleCache(taskId);

    if (!enabled) {
      setSchedules(currentCache.schedules);
      setIsLoading(false);
      setError(currentCache.error);
      return () => {
        isMounted = false;
      };
    }

    const loadSchedules = async () => {
      setSchedules(currentCache.schedules);
      setIsLoading(!currentCache.hasLoaded);
      setError('');

      try {
        const taskSchedules = await loadCachedSchedules({
          force: reloadToken > 0,
          taskId,
        });

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
  }, [enabled, reloadToken, taskId]);

  return {
    schedules,
    isLoading,
    error,
    // The dashboard calls this after creating a schedule to refresh the list.
    reloadSchedules: () => setReloadToken((currentValue) => currentValue + 1),
  };
};
