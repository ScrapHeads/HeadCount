import { useEffect, useState } from 'react';
import { watchActiveStudents } from './studentService';

export const useActiveStudents = () => {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setIsLoading(true);
    setError('');

    const unsubscribe = watchActiveStudents(
      (activeStudents) => {
        setStudents(activeStudents);
        setIsLoading(false);
      },
      (loadError) => {
        setError(loadError?.message || 'Failed to load active students.');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  return {
    students,
    isLoading,
    error,
  };
};
