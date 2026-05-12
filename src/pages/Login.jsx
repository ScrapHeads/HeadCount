import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';
import { branding } from '../config/branding';
import { useAuth } from '../features/auth/useAuth.jsx';

const Login = () => {
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signInStudent, studentSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (studentSession) {
      navigate('/student/session', { replace: true });
    }
  }, [studentSession, navigate]);

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    if (!studentId) {
      setError('Please enter your student ID.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await signInStudent({ studentId });
      navigate('/student/session', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Student login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,_var(--app-secondary)_25%,_transparent)_0%,_transparent_45%)]" />
      <div className="absolute -left-20 top-40 h-48 w-48 rounded-full bg-secondary/15 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-secondary/17 blur-3xl" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-primary shadow-2xl shadow-primary/10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-between bg-[linear-gradient(135deg,var(--app-primary)_0%,color-mix(in_oklab,var(--app-primary)_70%,var(--app-accent))_48%,var(--app-accent)_100%)] p-8 text-on-primary sm:p-10">
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
            <p className="text-sm font-semibold">Designed for reuse</p>
            <p className="mt-2 text-sm leading-6 text-on-primary/80">
              Teams can copy this project, update one branding file, and keep the rest of the app structure intact.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mx-auto flex max-w-md flex-col">
            <div className="mb-8 space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">
                Student Hours
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-on-primary">
                Enter your student ID
              </h2>
              <p className="text-sm leading-6 text-on-primary">
                Start here for the main sign-in and sign-out workflow. Coach and demo access are still available from the secondary portal.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleStudentLogin}>
              <Input
                className="placeholder:!text-on-secondary focus:border-accent focus:ring-accent/15"
                label="Student ID"
                type="text"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="Enter your student ID"
                required
              />
              <Button className="bg-secondary border-2 border-transparent text-on-secondary hover:border-accent" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Checking ID...' : 'Continue to Sign In / Out form'}
              </Button>
            </form>

            {error && (
              <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
                {error}
              </div>
            )}

            <Link
              className="mt-4 inline-flex items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-on-primary transition hover:bg-accent/10"
              to="/access"
            >
              Open coach and demo access
            </Link>

            <p className="mt-6 text-center text-xs leading-5 text-on-primary">
              Change brand colors in <code className="rounded bg-accent/10 px-1.5 py-0.5">src/config/branding.js</code>.
            </p>
            <p className="mt-3 text-center text-xs leading-5 text-on-primary">
              Students are matched against Firestore before entering the hours form.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Login;
