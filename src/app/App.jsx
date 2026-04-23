import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login';
import CoachDashboard from '../pages/CoachDashboard';
import StudentCheckIn from '../pages/StudentCheckIn';
import StudentCheckOut from '../pages/StudentCheckOut';
import NotFound from '../pages/NotFound';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/coach/dashboard" element={<CoachDashboard />} />
      <Route path="/student/checkin" element={<StudentCheckIn />} />
      <Route path="/student/checkout" element={<StudentCheckOut />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
