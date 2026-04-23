import React from 'react';
import { Link } from 'react-router-dom';
import { branding } from '../config/branding';

const CoachDashboard = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-2xl rounded-[2rem] border border-border bg-surface p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Coach View</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text">Coach Dashboard</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          This placeholder confirms the routed demo is working. Teams can replace this page with their dashboard while keeping the shared branding from {branding.appName}.
        </p>
        <Link className="mt-6 inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-onPrimary transition hover:bg-primary-strong" to="/">
          Back to login
        </Link>
      </section>
    </main>
  );
};

export default CoachDashboard;
