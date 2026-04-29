// Teams should primarily edit this file when they want to rebrand the app.
// Keep the palette values as hex colors so the derived tokens stay predictable.
export const branding = {
  appName: 'Robotics Team Hours Tracker',
  tagline: 'Track team hours with a setup that is easy to copy, reuse, and rebrand.',
  teamLabel: 'Your Team Name',
  theme: {
    fontFamily: '"Segoe UI", Arial, sans-serif',
    colors: {
      primary: '#132840',
      secondary: '#ffffff',
      accent: '#7da6cc',
      background: '#eef3f9',
      text: '#132840',
    },
  },
};

const normalizeHexColor = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const cleanedValue = value.trim().replace(/^#/, '');

  if (/^[\da-fA-F]{3}$/.test(cleanedValue)) {
    return `#${cleanedValue.split('').map((char) => `${char}${char}`).join('').toLowerCase()}`;
  }

  if (/^[\da-fA-F]{6}$/.test(cleanedValue)) {
    return `#${cleanedValue.toLowerCase()}`;
  }

  return null;
};

const hexToRgb = (value) => {
  const normalizedColor = normalizeHexColor(value);

  if (!normalizedColor) {
    return null;
  }

  return {
    r: Number.parseInt(normalizedColor.slice(1, 3), 16),
    g: Number.parseInt(normalizedColor.slice(3, 5), 16),
    b: Number.parseInt(normalizedColor.slice(5, 7), 16),
  };
};

const rgbToHex = ({ r, g, b }) => `#${[r, g, b]
  .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
  .join('')}`;

const mixHexColors = (startColor, endColor, endWeight) => {
  const startRgb = hexToRgb(startColor);
  const endRgb = hexToRgb(endColor);

  if (!startRgb || !endRgb) {
    return startColor;
  }

  const weight = Math.max(0, Math.min(1, endWeight));

  return rgbToHex({
    r: startRgb.r + (endRgb.r - startRgb.r) * weight,
    g: startRgb.g + (endRgb.g - startRgb.g) * weight,
    b: startRgb.b + (endRgb.b - startRgb.b) * weight,
  });
};

const getRelativeLuminance = (value) => {
  const rgb = hexToRgb(value);

  if (!rgb) {
    return 0;
  }

  const toLinearChannel = (channel) => {
    const normalizedChannel = channel / 255;

    return normalizedChannel <= 0.03928
      ? normalizedChannel / 12.92
      : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
  };

  return (
    (0.2126 * toLinearChannel(rgb.r))
    + (0.7152 * toLinearChannel(rgb.g))
    + (0.0722 * toLinearChannel(rgb.b))
  );
};

const pickReadableTextColor = (backgroundColor) => (
  getRelativeLuminance(backgroundColor) > 0.45 ? '#0f172a' : '#ffffff'
);

const deriveThemeColors = (colors) => ({
  ...colors,
  border: mixHexColors(colors.text, colors.secondary, 0.82),
  textMuted: mixHexColors(colors.text, colors.background, 0.3),
  onPrimary: pickReadableTextColor(colors.primary),
  onAccent: pickReadableTextColor(colors.accent),
});

// This bridges the editable branding object into CSS custom properties.
// Tailwind then reads those variables from src/styles/globals.css so the
// UI keeps semantic utility classes while the palette stays simple to edit.
export const applyBrandingTheme = (root = document.documentElement) => {
  const { fontFamily, colors } = branding.theme;
  const derivedColors = deriveThemeColors(colors);

  const cssVariables = {
    '--font-family-sans': fontFamily,
    '--app-primary': derivedColors.primary,
    '--app-secondary': derivedColors.secondary,
    '--app-accent': derivedColors.accent,
    '--app-background': derivedColors.background,
    '--app-text': derivedColors.text,
    '--app-text-muted': derivedColors.textMuted,
    '--app-border': derivedColors.border,
    '--app-on-primary': derivedColors.onPrimary,
    '--app-on-accent': derivedColors.onAccent,
  };

  Object.entries(cssVariables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
};
