import React from 'react';
import { AuthProvider } from '../features/auth/useAuth.jsx';

// Keep app-wide providers in one place. New providers, such as localization or
// error reporting, can be added here without changing the page components.
const AppProviders = ({ children }) => {
  return <AuthProvider>{children}</AuthProvider>;
};

export default AppProviders;
