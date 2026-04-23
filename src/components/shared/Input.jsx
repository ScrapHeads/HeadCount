import React from 'react';

const Input = ({ className = '', label, type = 'text', value, onChange, ...props }) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-sm font-medium text-text">{label}</label>}
    <input
      className={`w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-muted/70 focus:border-primary focus:ring-4 focus:ring-primary/15 ${className}`}
      type={type}
      value={value}
      onChange={onChange}
      {...props}
    />
  </div>
);

export default Input;
