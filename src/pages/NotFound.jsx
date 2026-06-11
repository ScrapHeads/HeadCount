import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-xl rounded-[2rem] border border-border bg-secondary p-8 text-center shadow-2xl shadow-primary/10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-on-secondary">Page Not Found</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          The page you requested does not exist or has been moved.
        </p>
        <Link className="mt-6 inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90" to="/">
          Return to access portal
        </Link>
      </section>
    </main>
  );
};

export default NotFound;
