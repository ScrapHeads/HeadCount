// Keeping route paths in one place prevents links and router definitions from
// quietly drifting apart when a page URL changes.
export const ROUTES = Object.freeze({
  accessPortal: '/',
  legacyAccessPortal: '/access',
  kiosk: '/kiosk',
  coachDashboard: '/coach/dashboard',
  studentDashboard: '/student/dashboard',
  studentSession: '/student/session',
  legacyStudentCheckIn: '/student/checkin',
  studentCheckOut: '/student/checkout',
});
