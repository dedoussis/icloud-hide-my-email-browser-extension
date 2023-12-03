import React from 'react';
import { render } from 'react-dom';

import Userguide from './Userguide';
import './index.css';
import contentScript from '../Content/script';

render(
  <Userguide />,
  window.document.querySelector('#app-container'),
  contentScript
);
