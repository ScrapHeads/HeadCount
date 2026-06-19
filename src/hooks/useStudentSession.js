import { useEffect, useState } from 'react';
import { STUDENT_SESSION_STORAGE_KEY } from '../lib/constants';

const readStoredSession = () => {
  const rawSession = window.sessionStorage.getItem(STUDENT_SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession);
  } catch {
    window.sessionStorage.removeItem(STUDENT_SESSION_STORAGE_KEY);
    return null;
  }
};

// sessionStorage is scoped to one browser tab. It remembers which student is
// using that tab, but it is not a security boundary; Firestore rules still
// decide which data the Firebase user may read or change.
export const useStudentSession = () => {
  const [studentSession, setStudentSession] = useState(() => readStoredSession());

  useEffect(() => {
    if (studentSession) {
      window.sessionStorage.setItem(
        STUDENT_SESSION_STORAGE_KEY,
        JSON.stringify(studentSession),
      );
      return;
    }

    window.sessionStorage.removeItem(STUDENT_SESSION_STORAGE_KEY);
  }, [studentSession]);

  return {
    studentSession,
    setStudentSession,
  };
};
