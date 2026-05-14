import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ManagerPage from './ManagerPage';
import './style.css';

const container = document.getElementById('app-container') as HTMLElement;
const root = createRoot(container);
root.render(
  <StrictMode>
    <ManagerPage />
  </StrictMode>
);
