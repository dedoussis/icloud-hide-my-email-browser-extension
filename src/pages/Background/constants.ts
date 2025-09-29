import browser from 'webextension-polyfill';

export const CONTEXT_MENU_ITEM_ID = browser.runtime.id.concat(
  '/',
  'hme_generation_and_reservation'
);

export const SIGNED_OUT_CTA_COPY = 'Please sign-in to iCloud';
export const LOADING_COPY = 'Hide My Email+ — Loading...';
export const SIGNED_IN_CTA_COPY = 'Generate and reserve a Hide My Email+ alias';
export const NOTIFICATION_MESSAGE_COPY =
  'The iCloud Hide My Email+ extension is ready to use!';
export const NOTIFICATION_TITLE_COPY = 'iCloud Hide My Email+ Extension';
