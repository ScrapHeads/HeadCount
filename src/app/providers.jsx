import React from 'react';
import { AuthProvider } from '../features/auth/useAuth.jsx';

const AppProviders = ({ children }) => {
  return <AuthProvider>{children}</AuthProvider>;
};

export default AppProviders;
