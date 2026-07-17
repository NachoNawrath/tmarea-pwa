import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import P1_VesselProfile from './screens/P1_VesselProfile';
import P2_VoyageSetup from './screens/P2_VoyageSetup';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/vessel-profile" element={<P1_VesselProfile />} />
      <Route path="/voyage-setup" element={<P2_VoyageSetup />} />
      <Route path="/voyage-check" element={<div style={{padding:'40px'}}>P3 próximamente</div>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>
);