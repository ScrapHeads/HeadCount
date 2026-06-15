import React from 'react';

const CardMessage = ({ children, tone = 'muted' }) => (
  <div
    className={`mt-5 rounded-2xl border px-4 py-4 text-sm ${
      tone === 'error'
        ? 'border-accent/30 bg-accent/12 text-on-primary'
        : 'border-border bg-accent/10 text-on-primary/90'
    }`}
  >
    {children}
  </div>
);

export default CardMessage;
