import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';
import { branding } from '../config/branding';
import { useAuth } from '../features/auth/useAuth.jsx';

const KioskStudentLogin = () => {
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    isLoadingCoachAuth,
    kioskUser,
    signInStudent,
    signOutKiosk,
    studentSession,
  } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (studentSession) {
      const destination = studentSession.isFirebaseAuthenticated
        ? '/student/dashboard'
        : '/student/session';

      navigate(destination, { replace: true });
    }
  }, [studentSession, navigate]);

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    if (!studentId) {
      setError('Please enter your student ID or scan your NFC card.');
      return;
    }

    if (!kioskUser) {
      setError('This device must be signed in as the student kiosk before students can sign in or scan a card.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const student = await signInStudent({ studentId });
      const destination = student.isFirebaseAuthenticated
        ? '/student/dashboard'
        : '/student/session';

      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Student login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKioskSignOut = async () => {
    await signOutKiosk();
    navigate('/', { replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,_var(--app-secondary)_25%,_transparent)_0%,_transparent_45%)]" />
      <div className="absolute -left-20 top-40 h-48 w-48 rounded-full bg-secondary/15 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-secondary/17 blur-3xl" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-primary shadow-2xl shadow-primary/10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-between bg-[linear-gradient(135deg,var(--app-primary)_0%,color-mix(in_oklab,var(--app-primary)_70%,var(--app-accent))_48%,var(--app-accent)_100%)] p-8 text-on-primary sm:p-10">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.15em] text-on-primary/90">
                {branding.teamLabel}
              </p>
              <h1 className="max-w-md text-4xl font-semibold tracking-tight sm:text-5xl">
                {branding.appName}
              </h1>
              <p className="max-w-lg text-sm leading-6 text-on-primary/90 sm:text-base">
                {branding.tagline}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mx-auto flex max-w-md flex-col">
            <div className="mb-8 space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">
                Student Hours
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-on-primary">
                Enter your student ID or scan your NFC card
              </h2>
            </div>

            {!isLoadingCoachAuth && !kioskUser && (
              <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
                Sign in this device as the student kiosk before students enter an ID or scan a card.
              </div>
            )}

            <form className="space-y-4" onSubmit={handleStudentLogin}>
              <Input
                autoComplete="off"
                autoFocus
                className="placeholder:!text-on-secondary focus:border-accent focus:ring-accent/15"
                label="Student ID or NFC Card ID"
                type="text"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="Enter student ID or scan card"
                required
              />
              <Button className="bg-secondary border-2 border-transparent text-on-secondary hover:border-accent" disabled={isSubmitting || isLoadingCoachAuth || !kioskUser} type="submit">
                {isSubmitting ? 'Checking ID...' : 'Continue to Sign In / Out form'}
              </Button>
            </form>

            {error && (
              <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-on-primary">
                {error}
              </div>
            )}

            <p className="mt-4 text-center text-xs leading-5 text-on-primary ">
              NFC scanners that type the card serial number and press Enter are supported.
            </p>

            <button
              className="mt-4 text-center font-semibold text-on-primary underline-offset-4 hover:underline sm:text-center"
              onClick={handleKioskSignOut}
              type="button"
            >
              Sign out of kiosk
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default KioskStudentLogin;
