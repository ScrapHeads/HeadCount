import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';
import { branding } from '../config/branding';
import { useAuth } from '../features/auth/useAuth.jsx';

const AccessPortal = () => {
  const [role, setRole] = useState('student');
  const [coachEmail, setCoachEmail] = useState('');
  const [coachPassword, setCoachPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { coachUser, signInCoach, signInStudent, studentSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (coachUser) {
      navigate('/coach/dashboard', { replace: true });
    }
  }, [coachUser, navigate]);

  useEffect(() => {
    if (studentSession) {
      navigate('/student/session', { replace: true });
    }
  }, [studentSession, navigate]);

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
      navigate('/student/session', { replace: true });
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
      <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-surface-muted blur-3xl" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-surface shadow-[0_30px_100px_-40px_rgba(15,23,42,0.45)] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-between bg-linear-to-br from-primary to-primary-strong p-8 text-onPrimary sm:p-10">
          <div className="space-y-5">
            <p className="inline-flex w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
              Demo Template
            </p>
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/75">
                {branding.teamLabel}
              </p>
              <h1 className="max-w-md text-4xl font-semibold tracking-tight sm:text-5xl">
                {branding.appName}
              </h1>
              <p className="max-w-lg text-sm leading-6 text-white/80 sm:text-base">
                {branding.tagline}
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-sm font-semibold">Alternative access</p>
            <p className="mt-2 text-sm leading-6 text-white/80">
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
              <h2 className="text-3xl font-semibold tracking-tight text-text">
                Choose sign-in type
              </h2>
            </div>

            <div className="mb-6 inline-flex rounded-2xl bg-surface-muted p-1">
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
                <span className={`flex cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${role === 'student' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'}`}>
                  Student
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
                <span className={`flex cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${role === 'coach' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'}`}>
                  Coach
                </span>
              </label>
            </div>

            {role === 'coach' ? (
              <form className="space-y-4" onSubmit={handleCoachLogin}>
                <Input
                  label="Email"
                  type="email"
                  value={coachEmail}
                  onChange={(e) => setCoachEmail(e.target.value)}
                  placeholder="coach@team.org"
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  value={coachPassword}
                  onChange={(e) => setCoachPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Signing In...' : 'Login as Coach'}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleStudentLogin}>
                <Input
                  label="Student ID"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Enter your student ID"
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  placeholder="Enter your student password"
                  required
                />
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Checking credentials...' : 'Continue as Student'}
                </Button>
              </form>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger">
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
