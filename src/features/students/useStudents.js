import { useEffect, useState } from 'react';
import { watchActiveStudents, watchStudents } from './studentService';

const allStudentsCache = {
  error: '',
  hasLoaded: false,
  students: [],
};

const activeStudentsCache = {
  error: '',
  hasLoaded: false,
  students: [],
};

const useStudentSubscription = ({
  cache,
  enabled = true,
  loadErrorMessage,
  watch,
}) => {
  const [students, setStudents] = useState(() => cache.students);
  const [isLoading, setIsLoading] = useState(() => enabled && !cache.hasLoaded);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setStudents(cache.students);
      setIsLoading(false);
      setError(cache.error);
      return undefined;
    }

    setStudents(cache.students);
    setIsLoading(!cache.hasLoaded);
    setError('');

    const unsubscribe = watch(
      (loadedStudents) => {
        cache.error = '';
        cache.hasLoaded = true;
        cache.students = loadedStudents;
        setStudents(loadedStudents);
        setIsLoading(false);
      },
      (loadError) => {
        const message = loadError?.message || loadErrorMessage;

        cache.error = message;
        setError(message);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [cache, enabled, loadErrorMessage, watch]);

  return {
    students,
    isLoading,
    error,
  };
};

export const useActiveStudents = ({ enabled = true } = {}) => {
  return useStudentSubscription({
    cache: activeStudentsCache,
    enabled,
    loadErrorMessage: 'Failed to load active students.',
    watch: watchActiveStudents,
  });
};

export const useStudents = ({ enabled = true } = {}) => {
  return useStudentSubscription({
    cache: allStudentsCache,
    enabled,
    loadErrorMessage: 'Failed to load students.',
    watch: watchStudents,
  });
};
