import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';
import { kioskAuthConfig } from '../config/appConfig';
import { branding } from '../config/branding';
import { useAuth } from '../features/auth/useAuth.jsx';

const AccessPortal = () => {
  const [role, setRole] = useState('student');
  const [coachEmail, setCoachEmail] = useState('');
  const [coachPassword, setCoachPassword] = useState('');
  const [kioskEmail, setKioskEmail] = useState(kioskAuthConfig.email);
  const [kioskPassword, setKioskPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signInCoach, signInKiosk, signInStudent } = useAuth();
  const navigate = useNavigate();

  const handleCoachLogin = async (e) => {
    e.preventDefault();
    if (!coachEmail || !coachPassword) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await signInCoach({ email: coachEmail, password: coachPassword });
      navigate('/coach/dashboard', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Coach login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKioskLogin = async (e) => {
    e.preventDefault();
    if (!kioskEmail || !kioskPassword) {
      setError('Please enter both kiosk email and password.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await signInKiosk({ email: kioskEmail, password: kioskPassword });
      navigate('/', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Kiosk login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    if (!studentId || !studentPassword) {
      setError('Please enter both student ID and password.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await signInStudent({
        studentId,
        password: studentPassword,
        requirePassword: true,
      });
      navigate('/student/dashboard', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Student login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,_var(--app-primary)_18%,_transparent)_0%,_transparent_45%)]" />
      <div className="absolute -left-20 top-10 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-accent/18 blur-3xl" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-primary shadow-2xl shadow-primary/10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-between 
          bg-[linear-gradient(135deg,var(--app-primary)_0%,color-mix(in_oklab,var(--app-primary)_70%,var(--app-accent))_50%,var(--app-accent)_100%)]
          p-8 text-on-primary sm:p-10">
          <div className="space-y-5">
            <p className="inline-flex w-fit rounded-full border border-on-primary/20 bg-on-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
              Demo Template
            </p>
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-on-primary/75">
                {branding.teamLabel}
              </p>
              <h1 className="max-w-md text-4xl font-semibold tracking-tight sm:text-5xl">
                {branding.appName}
              </h1>
              <p className="max-w-lg text-sm leading-6 text-on-primary/80 sm:text-base">
                {branding.tagline}
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-on-primary/15 bg-on-primary/10 p-5 backdrop-blur-sm">
            <p className="text-sm font-semibold">Alternative access</p>
            <p className="mt-2 text-sm leading-6 text-on-primary/80">
              This page preserves the original multi-role entry point for demos, staff access, and testing.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mx-auto flex max-w-md flex-col">
            <div className="mb-8 space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Access Portal
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-on-secondary">
                Choose sign-in type
              </h2>
            </div>

            <div className="mb-6 grid grid-cols-3 rounded-2xl bg-accent/10 p-1">
              <label className="flex-1">
                <input
                  className="sr-only"
                  type="radio"
                  value="student"
                  checked={role === 'student'}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setError('');
                  }}
                />
                <span className={`flex cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${role === 'student' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-text-muted hover:text-on-secondary'}`}>
                  Student
                </span>
              </label>
              <label className="flex-1">
                <input
                  className="sr-only"
                  type="radio"
                  value="kiosk"
                  checked={role === 'kiosk'}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setError('');
                  }}
                />
                <span className={`flex cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${role === 'kiosk' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-text-muted hover:text-on-secondary'}`}>
                  Kiosk
                </span>
              </label>
              <label className="flex-1">
                <input
                  className="sr-only"
                  type="radio"
                  value="coach"
                  checked={role === 'coach'}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setError('');
                  }}
                />
                <span className={`flex cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${role === 'coach' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-text-muted hover:text-on-secondary'}`}>
                  Coach
                </span>
              </label>
            </div>

            {role === 'coach' ? (
              <form className="space-y-4" onSubmit={handleCoachLogin}>
                <Input
                className='placeholder:!text-on-secondary'
                  label="Email"
                  type="email"
                  value={coachEmail}
                  onChange={(e) => setCoachEmail(e.target.value)}
                  placeholder="coach@team.org"
                  required
                />
                <Input
                  className='placeholder:!text-on-secondary'  
                  label="Password"
                  type="password"
                  value={coachPassword}
                  onChange={(e) => setCoachPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <Button disabled={isSubmitting} type="submit" className="bg-secondary border border-accent text-on-secondary">
                  {isSubmitting ? 'Signing In...' : 'Login as Coach'}
                </Button>
              </form>
            ) : role === 'kiosk' ? (
              <form className="space-y-4" onSubmit={handleKioskLogin}>
                <Input
                  className="placeholder:!text-on-secondary"
                  label="Kiosk email"
                  type="email"
                  value={kioskEmail}
                  onChange={(e) => setKioskEmail(e.target.value)}
                  placeholder={kioskAuthConfig.email || 'kiosk@team.org'}
                  required
                />
                <Input
                  className="placeholder:!text-on-secondary"
                  label="Kiosk password"
                  type="password"
                  value={kioskPassword}
                  onChange={(e) => setKioskPassword(e.target.value)}
                  placeholder="Enter kiosk password"
                  required
                />
                <Button disabled={isSubmitting} type="submit" className="bg-secondary border border-accent text-on-secondary">
                  {isSubmitting ? 'Signing in kiosk...' : 'Enable Student Kiosk'}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleStudentLogin}>
                <Input
                  className='placeholder:!text-on-secondary'    
                  label="Student ID"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Enter your student ID"
                  required
                />
                <Input
                  className='placeholder:!text-on-secondary'
                  label="Password"
                  type="password"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  placeholder="Enter your student password"
                  required
                />
                <Button disabled={isSubmitting} type="submit" className="bg-secondary border border-accent text-on-secondary">
                  {isSubmitting ? 'Opening dashboard...' : 'Continue as Student'}
                </Button>
              </form>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-secondary">
                {error}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default AccessPortal;
