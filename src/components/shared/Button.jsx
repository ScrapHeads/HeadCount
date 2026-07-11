const getButtonColorClassName = (className) => {
  const cleanedClassName = className
    .replace(/\btext-on-primary(?:\/\d+)?\b/g, '')
    .replace(/\btext-on-secondary(?:\/\d+)?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const textClassName = /\bbg-secondary(?:\b|\/)/.test(className)
    ? 'text-on-secondary'
    : 'text-on-primary';

  return `${textClassName} ${cleanedClassName}`.trim();
};

const Button = ({ children, className = '', type = 'button', ...props }) => {
  const colorClassName = getButtonColorClassName(className);

  return (
    <button
      className={`inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold shadow-lg shadow-primary/20 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-secondary disabled:cursor-not-allowed disabled:opacity-60 ${colorClassName}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
