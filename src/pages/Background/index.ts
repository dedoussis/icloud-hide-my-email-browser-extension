import 'regenerator-runtime/runtime.js';
import {
  getBrowserStorageValue,
  setBrowserStorageValue,
  Store,
  DEFAULT_OPTIONS,
  Options,
} from '../../storage';
import ICloudClient, {
  PremiumMailSettings,
  DEFAULT_SETUP_URL,
  CN_SETUP_URL,
} from '../../iCloudClient';
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
import {
  CONTEXT_MENU_ITEM_ID,
  LOADING_COPY,
  NOTIFICATION_MESSAGE_COPY,
  NOTIFICATION_TITLE_COPY,
  SIGNED_IN_CTA_COPY,
  SIGNED_OUT_CTA_COPY,
} from './constants';

if ((browser as unknown as typeof chrome).declarativeNetRequest === undefined) {
  setupBlockingWebRequestListeners();
}

const constructClient = async (): Promise<ICloudClient> => {
  const clientState = (await getBrowserStorageValue('clientState')) || [];

  return new ICloudClient(...clientState);
};

const performDeauthSideEffects = () => {
  setBrowserStorageValue('popupState', PopupState.SignedOut);
  setBrowserStorageValue('clientState', []);

  browser.contextMenus
    .update(CONTEXT_MENU_ITEM_ID, {
      title: SIGNED_OUT_CTA_COPY,
      enabled: false,
    })
    .catch(console.debug);
};

const performAuthSideEffects = (client: ICloudClient) => {
  setBrowserStorageValue('clientState', [client.setupUrl, client.webservices]);

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
        const client = await constructClient();
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
        const client = await constructClient();

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

// At any given time, there should be 1 created context menu item. We want to prevent
// the creation of multiple items that serve the same purpose (i.e. the context menu having multiple
// "Generate and reserve Hide My Email address" rows). Hence, we create the context menu item once,
// upon the installation of the extension.
browser.runtime.onInstalled.addListener(async () => {
  const options = await getBrowserStorageValue('iCloudHmeOptions');

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
      const client = await constructClient();
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
  const iCloudHmeOptions = changes['iCloudHmeOptions' as keyof Store];
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

  const client = await constructClient();
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
    const { statusCode, url } = details;
    if (statusCode < 200 && statusCode > 299) {
      console.debug('Request failed', details);
      return;
    }

    const setupUrl = url.split('/accountLogin')[0] as ICloudClient['setupUrl'];
    const client = new ICloudClient(setupUrl);
    const isAuthenticated = await client.isAuthenticated();
    if (isAuthenticated) {
      performAuthSideEffects(client);
    }
  },
  {
    urls: [
      `${DEFAULT_SETUP_URL}/accountLogin*`,
      `${CN_SETUP_URL}/accountLogin*`,
    ],
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
    urls: [`${DEFAULT_SETUP_URL}/logout*`, `${CN_SETUP_URL}/logout*`],
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
      const client = await constructClient();
      const isAuthenticated = await client.isAuthenticated();
      if (isAuthenticated) {
        performAuthSideEffects(client);
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
