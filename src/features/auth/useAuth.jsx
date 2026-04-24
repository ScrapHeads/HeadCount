import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  loginCoach,
  loginStudent,
  logoutCoach,
  updateStudentSessionState,
  watchCoachAuth,
} from './authServices';
import { useStudentSession } from '../../hooks/useStudentSession';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [coachUser, setCoachUser] = useState(null);
  const [isLoadingCoachAuth, setIsLoadingCoachAuth] = useState(true);
  const { studentSession, setStudentSession } = useStudentSession();

  useEffect(() => {
    const unsubscribe = watchCoachAuth((user) => {
      setCoachUser(user);
      setIsLoadingCoachAuth(false);
    });

    return unsubscribe;
  }, []);

  const signInCoach = async ({ email, password }) => {
    const user = await loginCoach({ email, password });
    setCoachUser(user);
    return user;
  };

  const signInStudent = async ({ studentId, password, requirePassword }) => {
    const student = await loginStudent({ studentId, password, requirePassword });
    setStudentSession(student);
    return student;
  };

  const signOutStudent = () => {
    setStudentSession(null);
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

  return (
    <AuthContext.Provider
      value={{
        coachUser,
        isLoadingCoachAuth,
        signInCoach,
        signOutCoach: signOutCurrentCoach,
        signInStudent,
        signOutStudent,
        studentSession,
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
