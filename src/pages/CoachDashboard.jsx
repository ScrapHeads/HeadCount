import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { branding } from '../config/branding';
import Button from '../components/shared/Button';
import { useAuth } from '../features/auth/useAuth.jsx';

const CoachDashboard = () => {
  const { coachUser, signOutCoach } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOutCoach();
    navigate('/', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-2xl rounded-[2rem] border border-border bg-surface p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Coach View</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text">Coach Dashboard</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Authenticated as <span className="font-semibold text-text">{coachUser?.email}</span>. Teams can replace this page with their dashboard while keeping the shared branding from {branding.appName}.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-text transition hover:bg-surface-muted" to="/">
            Return to login
          </Link>
          <Button className="sm:w-auto" onClick={handleSignOut} type="button">
            Sign out
          </Button>
        </div>
      </section>
    </main>
  );
};

export default CoachDashboard;
