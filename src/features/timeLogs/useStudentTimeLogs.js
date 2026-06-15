import { useEffect, useState } from 'react';
import { studentAuthConfig } from '../../config/appConfig';
import { listTimeLogsForStudent } from './timeLogService';

export const useStudentTimeLogs = ({ enabled = true, student }) => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const studentDocId = student?.id ?? '';
  const configuredStudentId = student?.[studentAuthConfig.idField] ?? '';
  const fallbackStudentId = student?.studentId ?? '';

  useEffect(() => {
    // An async request can finish after the user changes pages or students.
    // isMounted prevents that old request from updating current screen state.
    let isMounted = true;

    if (!enabled || (!studentDocId && !configuredStudentId && !fallbackStudentId)) {
      setLogs([]);
      setIsLoading(false);
      setError('');
      return () => {
        isMounted = false;
      };
    }

    const loadStudentTimeLogs = async () => {
      setIsLoading(true);
      setError('');

      try {
        const timeLogs = await listTimeLogsForStudent({
          student: {
            ...student,
            id: studentDocId,
            [studentAuthConfig.idField]: configuredStudentId,
            studentId: fallbackStudentId,
          },
        });

        if (isMounted) {
          setLogs(timeLogs);
        }
      } catch (loadError) {
        if (isMounted) {
          setLogs([]);
          setError(loadError?.message || 'Failed to load student time logs.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadStudentTimeLogs();

    return () => {
      isMounted = false;
    };
  }, [configuredStudentId, enabled, fallbackStudentId, student, studentDocId]);

  return {
    logs,
    isLoading,
    error,
  };
};
