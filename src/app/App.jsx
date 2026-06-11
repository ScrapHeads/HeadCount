import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.jsx';
import AccessPortal from '../pages/AccessPortal';
import KioskStudentLogin from '../pages/KioskStudentLogin';
import CoachDashboard from '../pages/CoachDashboard';
import StudentDashboard from '../pages/StudentDashboard';
import StudentCheckIn from '../pages/StudentCheckIn';
import StudentCheckOut from '../pages/StudentCheckOut';
import NotFound from '../pages/NotFound';

const FullScreenMessage = ({ message }) => (
  <main className="flex min-h-screen items-center justify-center bg-background px-4">
    <div className="rounded-2xl border border-border bg-secondary px-6 py-5 text-sm text-text-muted shadow-sm">
      {message}
    </div>
  </main>
);

const CoachRoute = ({ children }) => {
  const { coachUser, isLoadingCoachAuth } = useAuth();

  if (isLoadingCoachAuth) {
    return <FullScreenMessage message="Checking coach session..." />;
  }

  if (!coachUser) {
    return <Navigate replace to="/" />;
  }

  return children;
};

const KioskRoute = ({ children }) => {
  const { isLoadingCoachAuth, kioskUser } = useAuth();

  if (isLoadingCoachAuth) {
    return <FullScreenMessage message="Checking kiosk session..." />;
  }

  if (!kioskUser) {
    return <Navigate replace to="/" />;
  }

  return children;
};

const StudentRoute = ({ children }) => {
  const {
    isLoadingCoachAuth,
    kioskUser,
    studentSession,
    studentUser,
  } = useAuth();

  if (isLoadingCoachAuth) {
    return <FullScreenMessage message="Checking student session..." />;
  }

  if (!studentSession) {
    return <Navigate replace to={kioskUser ? '/kiosk' : '/'} />;
  }

  if (studentSession.authMode === 'kiosk') {
    if (!kioskUser) {
      return <Navigate replace to="/" />;
    }
  } else if (!studentUser) {
    return <Navigate replace to="/" />;
  }

  return children;
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<AccessPortal />} />
      <Route path="/access" element={<Navigate replace to="/" />} />
      <Route
        path="/kiosk"
        element={(
          <KioskRoute>
            <KioskStudentLogin />
          </KioskRoute>
        )}
      />
      <Route
        path="/coach/dashboard"
        element={(
          <CoachRoute>
            <CoachDashboard />
          </CoachRoute>
        )}
      />
      <Route
        path="/student/dashboard"
        element={(
          <StudentRoute>
            <StudentDashboard />
          </StudentRoute>
        )}
      />
      <Route
        path="/student/session"
        element={(
          <StudentRoute>
            <StudentCheckIn />
          </StudentRoute>
        )}
      />
      <Route
        path="/student/checkin"
        element={<Navigate replace to="/student/session" />}
      />
      <Route
        path="/student/checkout"
        element={(
          <StudentRoute>
            <StudentCheckOut />
          </StudentRoute>
        )}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
