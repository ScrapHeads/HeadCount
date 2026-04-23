import React from 'react';
import { Link } from 'react-router-dom';

const StudentCheckIn = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-2xl rounded-[2rem] border border-border bg-surface p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Student View</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text">Student Check-In</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          This placeholder marks the student check-in route. Replace the content here without needing to redo the shared theme setup.
        </p>
        <Link className="mt-6 inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-onPrimary transition hover:bg-primary-strong" to="/">
          Back to login
        </Link>
      </section>
    </main>
  );
};

export default StudentCheckIn;
