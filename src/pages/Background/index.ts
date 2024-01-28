import 'regenerator-runtime/runtime.js';
import {
  getBrowserStorageValue,
  POPUP_STATE_STORAGE_KEYS,
  OPTIONS_STORAGE_KEYS,
  setBrowserStorageValue,
} from '../../storage';
import ICloudClient, { PremiumMailSettings } from '../../iCloudClient';
import {
  ActiveInputElementWriteData,
  Message,
  MessageType,
  ReservationRequestData,
  sendMessageToTab,
} from '../../messages';
import { PopupState } from '../Popup/stateMachine';
import browser from 'webextension-polyfill';
import { setupBlockingWebRequestListeners } from '../../webRequestUtils';
import { DEFAULT_OPTIONS, Options } from '../../options';

if ((browser as unknown as typeof chrome).declarativeNetRequest === undefined) {
  setupBlockingWebRequestListeners();
}

const performDeauthSideEffects = async () => {
  await setBrowserStorageValue(POPUP_STATE_STORAGE_KEYS, PopupState.SignedOut);

  browser.contextMenus
    .update(CONTEXT_MENU_ITEM_ID, {
      title: SIGNED_OUT_CTA_COPY,
      enabled: false,
    })
    .catch(console.debug);
};

const performAuthSideEffects = () => {
  browser.contextMenus
    .update(CONTEXT_MENU_ITEM_ID, {
      title: SIGNED_IN_CTA_COPY,
      enabled: true,
    })
    .catch(console.debug);

  browser.notifications
    .create({
      type: 'basic',
      title: NOTIFICATION_TITLE_COPY,
      message: NOTIFICATION_MESSAGE_COPY,
      iconUrl: 'icon-128.png',
    })
    .catch(console.debug);
};

// ===== Message handling =====

browser.runtime.onMessage.addListener(async (message: Message<unknown>) => {
  switch (message.type) {
    case MessageType.GenerateRequest:
      {
        const elementId = message.data;
        const client = new ICloudClient();
        const isClientAuthenticated = await client.isAuthenticated();
        if (!isClientAuthenticated) {
          await sendMessageToTab(MessageType.GenerateResponse, {
            error: SIGNED_OUT_CTA_COPY,
            elementId,
          });
          performDeauthSideEffects();
          break;
        }

        try {
          const pms = new PremiumMailSettings(client);
          const hme = await pms.generateHme();
          await sendMessageToTab(MessageType.GenerateResponse, {
            hme,
            elementId,
          });
        } catch (e) {
          await sendMessageToTab(MessageType.GenerateResponse, {
            error: e.toString(),
            elementId,
          });
        }
      }
      break;
    case MessageType.ReservationRequest:
      {
        const { hme, label, elementId } =
          message.data as ReservationRequestData;
        const client = new ICloudClient();

        // TODO: Instead of re-validating the token,
        // find a way to persist the client state between the
        // generation and reservation events
        const isClientAuthenticated = await client.isAuthenticated();
        if (!isClientAuthenticated) {
          await sendMessageToTab(MessageType.GenerateResponse, {
            error: SIGNED_OUT_CTA_COPY,
            elementId,
          });
          performDeauthSideEffects();
          break;
        }

        try {
          const pms = new PremiumMailSettings(client);
          await pms.reserveHme(hme, label);
          await sendMessageToTab(MessageType.ReservationResponse, {
            hme,
            elementId,
          });
        } catch (e) {
          await sendMessageToTab(MessageType.ReservationResponse, {
            error: e.toString(),
            elementId,
          });
        }
      }
      break;
    default:
      break;
  }
});

// ===== Context menu =====

export const CONTEXT_MENU_ITEM_ID = browser.runtime.id.concat(
  '/',
  'hme_generation_and_reservation'
);

export const SIGNED_OUT_CTA_COPY = 'Please sign-in to iCloud';
const LOADING_COPY = 'Hide My Email — Loading...';
const SIGNED_IN_CTA_COPY = 'Generate and reserve Hide My Email address';
const NOTIFICATION_MESSAGE_COPY =
  'The iCloud HideMyEmail extension is ready to use!';
const NOTIFICATION_TITLE_COPY = 'iCloud HideMyEmail Extension';

// At any given time, there should be 1 created context menu item. We want to prevent
// the creation of multiple items that serve the same purpose (i.e. the context menu having multiple
// "Generate and reserve Hide My Email address" rows). Hence, we create the context menu item once,
// upon the installation of the extension.
browser.runtime.onInstalled.addListener(async () => {
  const options = await getBrowserStorageValue<Options>(OPTIONS_STORAGE_KEYS);

  browser.contextMenus.create(
    {
      id: CONTEXT_MENU_ITEM_ID,
      title: LOADING_COPY,
      contexts: ['editable'],
      enabled: false,
      visible:
        options?.autofill.contextMenu || DEFAULT_OPTIONS.autofill.contextMenu,
    },
    async () => {
      const client = new ICloudClient();
      const isClientAuthenticated = await client.isAuthenticated();
      if (!isClientAuthenticated) {
        performDeauthSideEffects();
        return;
      }

      browser.contextMenus
        .update(CONTEXT_MENU_ITEM_ID, {
          title: SIGNED_IN_CTA_COPY,
          enabled: true,
        })
        .catch(console.debug);
    }
  );
});

// The following callback detects changes in the autofill config of the user
// and acts accordingly. In particular:
// * it hides the context menu item when the user un-checks the context menu option.
// * it makes the context menu item visible when the user checks the context menu option.
browser.storage.onChanged.addListener((changes, namespace) => {
  const iCloudHmeOptions = changes[OPTIONS_STORAGE_KEYS[0]];
  if (namespace !== 'local' || iCloudHmeOptions === undefined) {
    return;
  }

  const {
    oldValue,
    newValue,
  }: browser.Storage.StorageChange<Options, Options> = iCloudHmeOptions;

  if (oldValue?.autofill.contextMenu === newValue?.autofill.contextMenu) {
    // No change has been made to the context menu autofilling config.
    // There is no need to create or remove a context menu item.
    return;
  }

  browser.contextMenus
    .update(CONTEXT_MENU_ITEM_ID, {
      visible:
        newValue?.autofill.contextMenu || DEFAULT_OPTIONS.autofill.contextMenu,
    })
    .catch(console.debug);
});

// Upon clicking on the context menu item, we generate an email, reserve it, and emit it back to the content script
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ITEM_ID) {
    return;
  }

  sendMessageToTab(
    MessageType.ActiveInputElementWrite,
    { text: LOADING_COPY } as ActiveInputElementWriteData,
    tab
  );

  const serializedUrl = info.pageUrl || tab?.url;
  const hostname = serializedUrl ? new URL(serializedUrl).hostname : '';

  const client = new ICloudClient();
  const isClientAuthenticated = await client.isAuthenticated();

  if (!isClientAuthenticated) {
    sendMessageToTab(
      MessageType.ActiveInputElementWrite,
      {
        text: SIGNED_OUT_CTA_COPY,
        copyToClipboard: false,
      } as ActiveInputElementWriteData,
      tab
    );
    performDeauthSideEffects();
    return;
  }

  try {
    const pms = new PremiumMailSettings(client);
    const hme = await pms.generateHme();
    await pms.reserveHme(hme, hostname);
    await sendMessageToTab(
      MessageType.ActiveInputElementWrite,
      { text: hme, copyToClipboard: true } as ActiveInputElementWriteData,
      tab
    );
  } catch (e) {
    sendMessageToTab(
      MessageType.ActiveInputElementWrite,
      {
        text: e.toString(),
        copyToClipboard: false,
      } as ActiveInputElementWriteData,
      tab
    );
  }
});

// ===== Non-blocking webrequest listeners (used for syncing the authentication state of the user) =====

// The extension needs to be in sync with the icloud.com authentication state of the browser.
// For example, when the user is authenticated we need to render the context menu item
// as enabled.
browser.webRequest.onResponseStarted.addListener(
  async (details: browser.WebRequest.OnResponseStartedDetailsType) => {
    const { statusCode } = details;
    if (statusCode < 200 && statusCode > 299) {
      console.debug('Request failed', details);
      return;
    }

    const client = new ICloudClient();
    const isAuthenticated = await client.isAuthenticated();
    if (isAuthenticated) {
      performAuthSideEffects();
    }
  },
  {
    urls: [`${ICloudClient.setupUrl}/accountLogin*`],
  },
  []
);

// When the user signs out of their account through icloud.com, we should
// perform various side effects (e.g. disabling the context menu item)
browser.webRequest.onResponseStarted.addListener(
  async (details: browser.WebRequest.OnResponseStartedDetailsType) => {
    const { statusCode } = details;
    if (statusCode < 200 && statusCode > 299) {
      console.debug('Request failed', details);
      return;
    }

    performDeauthSideEffects();
  },
  {
    urls: [`${ICloudClient.setupUrl}/logout*`],
  },
  []
);

// ===== Post installation hooks =====

// Sync the extension with the authentication state of the browser.
// If the user is already authenticated, they should not need to
// log out and log back in in order to get the extension working.
browser.runtime.onInstalled.addListener(
  async (details: browser.Runtime.OnInstalledDetailsType) => {
    if (['install', 'update'].includes(details.reason)) {
      const client = new ICloudClient();
      const isAuthenticated = await client.isAuthenticated();
      if (isAuthenticated) {
        performAuthSideEffects();
      } else {
        performDeauthSideEffects();
      }
    }
  }
);

// Present the user with a getting started guide.
browser.runtime.onInstalled.addListener(
  async (details: browser.Runtime.OnInstalledDetailsType) => {
    const userguideUrl = browser.runtime.getURL('userguide.html');

    if (details.reason === 'install') {
      chrome.tabs.create({ url: userguideUrl }).then(console.debug);
    }
  }
);
