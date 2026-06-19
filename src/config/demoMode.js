import { STUDENT_SESSION_STORAGE_KEY } from '../lib/constants';

export const DEMO_STATE_STORAGE_KEY = 'robotics-hours-demo-state:v1';

export const DEMO_CREDENTIALS = Object.freeze({
  coachEmail: 'demo.coach@team.local',
  kioskEmail: 'kiosk@myapp.internal',
  password: 'demo',
  studentId: '1001',
});

export const isDemoMode = (
  import.meta.env.MODE === 'demo'
  || import.meta.env.VITE_DEMO_MODE === 'true'
);

export const resetDemoState = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(DEMO_STATE_STORAGE_KEY);
  window.sessionStorage.removeItem(STUDENT_SESSION_STORAGE_KEY);
};
