// Teams should primarily edit this file when they want to rebrand the app.
// In most cases, changing the app name and theme colors here is enough.
export const branding = {
  appName: 'Robotics Team Hours Tracker',
  tagline: 'Track team hours with a setup that is easy to copy, reuse, and rebrand.',
  teamLabel: 'Your Team Name',
  theme: {
    fontFamily: '"Segoe UI", Arial, sans-serif',
    colors: {
      background: '#f3f7fb',
      surface: '#ffffff',
      surfaceMuted: '#e8f0fb',
      primary: '#2563eb',
      primaryStrong: '#1d4ed8',
      text: '#0f172a',
      textMuted: '#475569',
      border: '#cbd5e1',
      danger: '#b91c1c',
      dangerSurface: '#fef2f2',
      dangerBorder: '#fecaca',
      onPrimary: '#ffffff',
    },
  },
};

// This bridges the editable branding object into CSS custom properties.
// Tailwind then reads those variables from src/styles/globals.css so the
// UI can keep utility classes like bg-primary while still being easy to rebrand.
export const applyBrandingTheme = (root = document.documentElement) => {
  const { fontFamily, colors } = branding.theme;

  const cssVariables = {
    '--font-family-sans': fontFamily,
    '--app-background': colors.background,
    '--app-surface': colors.surface,
    '--app-surface-muted': colors.surfaceMuted,
    '--app-primary': colors.primary,
    '--app-primary-strong': colors.primaryStrong,
    '--app-text': colors.text,
    '--app-text-muted': colors.textMuted,
    '--app-border': colors.border,
    '--app-danger': colors.danger,
    '--app-danger-surface': colors.dangerSurface,
    '--app-danger-border': colors.dangerBorder,
    '--app-on-primary': colors.onPrimary,
  };

  Object.entries(cssVariables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
};
