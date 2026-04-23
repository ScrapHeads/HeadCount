import { useEffect, useState } from 'react';

const STORAGE_KEY = 'student-session';

const readStoredSession = () => {
  const rawSession = window.sessionStorage.getItem(STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession);
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const useStudentSession = () => {
  const [studentSession, setStudentSession] = useState(() => readStoredSession());

  useEffect(() => {
    if (studentSession) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(studentSession));
      return;
    }

    window.sessionStorage.removeItem(STORAGE_KEY);
  }, [studentSession]);

  return {
    studentSession,
    setStudentSession,
  };
};
