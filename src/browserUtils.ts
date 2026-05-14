import { browser } from 'wxt/browser';

export const isFirefox = browser.runtime
  .getURL('')
  .startsWith('moz-extension://');
