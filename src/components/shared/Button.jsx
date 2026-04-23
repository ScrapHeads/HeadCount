import React from 'react';

const Button = ({ children, className = '', type = 'button', ...props }) => (
  <button
    className={`inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-onPrimary shadow-lg shadow-primary/20 transition hover:bg-primary-strong focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    type={type}
    {...props}
  >
    {children}
  </button>
);

export default Button;
