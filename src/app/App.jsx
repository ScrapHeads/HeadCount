import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '../config/routesConfig';
import { useAuth } from '../features/auth/useAuth.jsx';

const AccessPortal = lazy(() => import('../pages/AccessPortal'));
const KioskStudentLogin = lazy(() => import('../pages/KioskStudentLogin'));
const CoachDashboard = lazy(() => import('../pages/CoachDashboard'));
const StudentDashboard = lazy(() => import('../pages/StudentDashboard'));
const StudentCheckIn = lazy(() => import('../pages/StudentCheckIn'));
const StudentCheckOut = lazy(() => import('../pages/StudentCheckOut'));
const NotFound = lazy(() => import('../pages/NotFound'));

const FullScreenMessage = ({ message }) => (
  <main className="flex min-h-screen items-center justify-center bg-background px-4">
    <div className="rounded-2xl border border-border bg-secondary px-6 py-5 text-sm text-text-muted shadow-sm">
      {message}
    </div>
  </main>
);

// Route guards prevent a page from briefly rendering before Firebase finishes
// restoring the signed-in user. Each guard also redirects the wrong account
// type back to the access portal.
const CoachRoute = ({ children }) => {
  const { coachUser, isLoadingCoachAuth } = useAuth();

  if (isLoadingCoachAuth) {
    return <FullScreenMessage message="Checking coach session..." />;
  }

  if (!coachUser) {
    return <Navigate replace to={ROUTES.accessPortal} />;
  }

  return children;
};

const KioskRoute = ({ children }) => {
  const { isLoadingCoachAuth, kioskUser } = useAuth();

  if (isLoadingCoachAuth) {
    return <FullScreenMessage message="Checking kiosk session..." />;
  }

  if (!kioskUser) {
    return <Navigate replace to={ROUTES.accessPortal} />;
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
    return <Navigate replace to={kioskUser ? ROUTES.kiosk : ROUTES.accessPortal} />;
  }

  // Kiosk students borrow the kiosk's Firebase login. Password students have
  // their own Firebase login, so the required account depends on authMode.
  if (studentSession.authMode === 'kiosk') {
    if (!kioskUser) {
      return <Navigate replace to={ROUTES.accessPortal} />;
    }
  } else if (!studentUser) {
    return <Navigate replace to={ROUTES.accessPortal} />;
  }

  return children;
};

const App = () => (
  <BrowserRouter>
    <Suspense fallback={<FullScreenMessage message="Loading page..." />}>
      <Routes>
        <Route path={ROUTES.accessPortal} element={<AccessPortal />} />
        <Route
          path={ROUTES.legacyAccessPortal}
          element={<Navigate replace to={ROUTES.accessPortal} />}
        />
        <Route
          path={ROUTES.kiosk}
          element={(
            <KioskRoute>
              <KioskStudentLogin />
            </KioskRoute>
          )}
        />
        <Route
          path={ROUTES.coachDashboard}
          element={(
            <CoachRoute>
              <CoachDashboard />
            </CoachRoute>
          )}
        />
        <Route
          path={ROUTES.studentDashboard}
          element={(
            <StudentRoute>
              <StudentDashboard />
            </StudentRoute>
          )}
        />
        <Route
          path={ROUTES.studentSession}
          element={(
            <StudentRoute>
              <StudentCheckIn />
            </StudentRoute>
          )}
        />
        <Route
          path={ROUTES.legacyStudentCheckIn}
          element={<Navigate replace to={ROUTES.studentSession} />}
        />
        <Route
          path={ROUTES.studentCheckOut}
          element={(
            <StudentRoute>
              <StudentCheckOut />
            </StudentRoute>
          )}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default App;
