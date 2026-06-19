import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  isKioskAuthEmail,
  isStudentAuthEmail,
  loginCoach,
  loginKiosk,
  loginStudent,
  logoutCoach,
  logoutKiosk,
  logoutStudent,
  updateStudentSessionState,
  watchCoachAuth,
} from './authServices';
import { useStudentSession } from '../../hooks/useStudentSession';

const AuthContext = createContext(null);

// AuthProvider combines Firebase's current user with the selected student
// profile. This is necessary because kiosk students share one Firebase account
// while password students each use their own account.
export const AuthProvider = ({ children }) => {
  const [coachUser, setCoachUser] = useState(null);
  const [kioskUser, setKioskUser] = useState(null);
  const [studentUser, setStudentUser] = useState(null);
  const [isLoadingCoachAuth, setIsLoadingCoachAuth] = useState(true);
  const { studentSession, setStudentSession } = useStudentSession();

  useEffect(() => {
    // Firebase can have only one current user per app instance. Classify that
    // user whenever Firebase restores or changes the browser login.
    const unsubscribe = watchCoachAuth((user) => {
      setCoachUser(user && !isStudentAuthEmail(user.email) && !isKioskAuthEmail(user.email) ? user : null);
      setKioskUser(user && isKioskAuthEmail(user.email) ? user : null);
      setStudentUser(user && isStudentAuthEmail(user.email) ? user : null);
      setIsLoadingCoachAuth(false);
    });

    return unsubscribe;
  }, []);

  const signInCoach = async ({ email, password }) => {
    const user = await loginCoach({ email, password });
    setCoachUser(user);
    setKioskUser(null);
    setStudentUser(null);
    return user;
  };

  const signInKiosk = async ({ email, password }) => {
    const user = await loginKiosk({ email, password });
    setCoachUser(null);
    setKioskUser(user);
    setStudentUser(null);
    return user;
  };

  const signInStudent = async ({ studentId, password, requirePassword }) => {
    const student = await loginStudent({ studentId, password, requirePassword });

    if (student.isFirebaseAuthenticated) {
      setCoachUser(null);
      setKioskUser(null);
      setStudentUser({
        email: student.authEmail,
        uid: student.authUid,
      });
    }

    // The student profile contains Firestore session fields that are not part
    // of the Firebase Authentication user object.
    setStudentSession(student);
    return student;
  };

  const signOutStudent = async () => {
    const activeStudentSession = studentSession;

    setStudentSession(null);

    if (activeStudentSession?.authMode === 'student') {
      await logoutStudent();
      setStudentUser(null);
    }
    // In kiosk mode the kiosk Firebase user intentionally remains signed in.
  };

  const updateStudentSession = async (updates) => {
    if (!studentSession?.id) {
      throw new Error('No student session is available to update.');
    }

    const updatedFields = await updateStudentSessionState({
      studentDocId: studentSession.id,
      updates,
    });

    const updatedSession = {
      ...studentSession,
      ...updatedFields,
    };

    setStudentSession(updatedSession);
    return updatedSession;
  };

  const signOutCurrentCoach = async () => {
    await logoutCoach();
    setCoachUser(null);
  };

  const signOutCurrentKiosk = async () => {
    setStudentSession(null);
    await logoutKiosk();
    setKioskUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        coachUser,
        isLoadingCoachAuth,
        kioskUser,
        signInCoach,
        signInKiosk,
        signOutCoach: signOutCurrentCoach,
        signOutKiosk: signOutCurrentKiosk,
        signInStudent,
        signOutStudent,
        studentSession,
        studentUser,
        updateStudentSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
};
