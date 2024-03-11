import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import Options from './Options';
import './index.css';

const container = document.getElementById('app-container') as HTMLElement;
const root = createRoot(container);
root.render(
  <StrictMode>
    <Options />
  </StrictMode>
);
