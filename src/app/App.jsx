import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.jsx';
import Login from '../pages/Login';
import CoachDashboard from '../pages/CoachDashboard';
import StudentCheckIn from '../pages/StudentCheckIn';
import StudentCheckOut from '../pages/StudentCheckOut';
import NotFound from '../pages/NotFound';

const FullScreenMessage = ({ message }) => (
  <main className="flex min-h-screen items-center justify-center bg-background px-4">
    <div className="rounded-2xl border border-border bg-surface px-6 py-5 text-sm text-text-muted shadow-sm">
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

const StudentRoute = ({ children }) => {
  const { studentSession } = useAuth();

  if (!studentSession) {
    return <Navigate replace to="/" />;
  }

  return children;
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/coach/dashboard"
        element={(
          <CoachRoute>
            <CoachDashboard />
          </CoachRoute>
        )}
      />
      <Route
        path="/student/checkin"
        element={(
          <StudentRoute>
            <StudentCheckIn />
          </StudentRoute>
        )}
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
