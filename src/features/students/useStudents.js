import { useEffect, useState } from 'react';
import { watchActiveStudents, watchStudents } from './studentService';

const useStudentSubscription = ({ loadErrorMessage, watch }) => {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setIsLoading(true);
    setError('');

    const unsubscribe = watch(
      (loadedStudents) => {
        setStudents(loadedStudents);
        setIsLoading(false);
      },
      (loadError) => {
        setError(loadError?.message || loadErrorMessage);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [loadErrorMessage, watch]);

  return {
    students,
    isLoading,
    error,
  };
};

export const useActiveStudents = () => {
  return useStudentSubscription({
    loadErrorMessage: 'Failed to load active students.',
    watch: watchActiveStudents,
  });
};

export const useStudents = () => {
  return useStudentSubscription({
    loadErrorMessage: 'Failed to load students.',
    watch: watchStudents,
  });
};
