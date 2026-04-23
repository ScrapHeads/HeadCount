import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import AppProviders from './app/providers';
import { applyBrandingTheme } from './config/branding';
import './styles/globals.css';

const container = document.getElementById('root');
const root = createRoot(container);

// Apply team branding before the UI renders so Tailwind-backed theme tokens
// are available on first paint.
applyBrandingTheme();

root.render(
  <AppProviders>
    <App />
  </AppProviders>,
);
