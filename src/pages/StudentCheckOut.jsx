import React from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../config/routesConfig';

const StudentCheckOut = () => {
  return <Navigate replace to={ROUTES.studentSession} />;
};

export default StudentCheckOut;
