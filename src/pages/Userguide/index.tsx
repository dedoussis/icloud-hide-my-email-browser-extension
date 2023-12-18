import React from 'react';
import { createRoot } from 'react-dom/client';

import Userguide from './Userguide';
import './index.css';
import contentScript from '../Content/script';

const container = document.getElementById('app-container') as HTMLElement;
const root = createRoot(container);
root.render(<Userguide />);
requestIdleCallback(contentScript);
