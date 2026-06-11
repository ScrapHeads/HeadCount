import { useCallback, useEffect, useState } from 'react';
import {
  watchExtraTimeRequests,
  watchExtraTimeRequestsForStudent,
} from './extraTimeRequestService';

const useRequestSubscription = ({ enabled = true, subscribe }) => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setRequests([]);
      setIsLoading(false);
      setError('');
      return undefined;
    }

    setIsLoading(true);
    setError('');

    return subscribe(
      (loadedRequests) => {
        setRequests(loadedRequests);
        setIsLoading(false);
      },
      (loadError) => {
        setRequests([]);
        setError(loadError?.message || 'Failed to load extra-time requests.');
        setIsLoading(false);
      },
    );
  }, [enabled, subscribe]);

  return { requests, isLoading, error };
};

export const useExtraTimeRequests = () => useRequestSubscription({
  subscribe: watchExtraTimeRequests,
});

export const useStudentExtraTimeRequests = (student) => {
  const studentDocId = student?.id ?? '';
  const studentId = String(student?.studentId ?? '');
  const studentName = student?.name ?? 'Student';
  const authMode = student?.authMode ?? '';
  const subscribe = useCallback(
    (onData, onError) => watchExtraTimeRequestsForStudent({
      student: {
        id: studentDocId,
        studentId,
        name: studentName,
        authMode,
      },
      onData,
      onError,
    }),
    [authMode, studentDocId, studentId, studentName],
  );

  return useRequestSubscription({
    enabled: Boolean(studentDocId),
    subscribe,
  });
};
