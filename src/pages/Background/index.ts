import 'regenerator-runtime/runtime.js';
import browser from 'webextension-polyfill';
import { isFirefox } from '../../browserUtils';
import ICloudClient, {
  CN_SETUP_URL,
  DEFAULT_SETUP_URL,
  PremiumMailSettings,
} from '../../iCloudClient';
import {
  AutofillData,
  Message,
  MessageType,
  ReservationRequestData,
  sendMessageToTab,
  StoreXPathData,
} from '../../messages';
import {
  DEFAULT_STORE,
  getBrowserStorageValue,
  Options,
  setBrowserStorageValue,
  Store,
} from '../../storage';
import {
  CONTEXT_MENU_ITEM_ID,
  LOADING_COPY,
  NOTIFICATION_MESSAGE_COPY,
  NOTIFICATION_TITLE_COPY,
  SIGNED_IN_CTA_COPY,
  SIGNED_OUT_CTA_COPY,
} from './constants';

const constructClient = async (): Promise<ICloudClient> => {
  const clientState = await getBrowserStorageValue('clientState');

  if (clientState === undefined) {
    console.debug('constructClient: Using default setupUrl');
    return new ICloudClient(DEFAULT_SETUP_URL);
  }

  return new ICloudClient(clientState.setupUrl, clientState.webservices);
};

const performDeauthSideEffects = () => {
  setBrowserStorageValue('popupState', DEFAULT_STORE.popupState);
  setBrowserStorageValue('clientState', DEFAULT_STORE.clientState);

  browser.contextMenus
    .update(CONTEXT_MENU_ITEM_ID, {
      title: SIGNED_OUT_CTA_COPY,
      enabled: false,
    })
    .catch(console.debug);
};

const performAuthSideEffects = (
  client: ICloudClient,
  options: { notification?: boolean } = {}
) => {
  const { notification = false } = options;

  setBrowserStorageValue('clientState', {
    setupUrl: client.setupUrl,
    webservices: client.webservices,
  });

  browser.contextMenus
    .update(CONTEXT_MENU_ITEM_ID, {
      title: SIGNED_IN_CTA_COPY,
      enabled: true,
    })
    .catch(console.debug);

  notification &&
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

browser.runtime.onMessage.addListener(async (uncastedMessage: unknown) => {
  const message = uncastedMessage as Message<unknown>;

  switch (message.type) {
    case MessageType.GenerateRequest:
      {
        const deauthCallback = async () => {
          await sendMessageToTab(MessageType.GenerateResponse, {
            error: SIGNED_OUT_CTA_COPY,
            elementId,
          });
          performDeauthSideEffects();
        };

        const elementId = message.data;

        const clientState = await getBrowserStorageValue('clientState');
        if (clientState === undefined) {
          await deauthCallback();
          break;
        }

        const client = new ICloudClient(
          clientState.setupUrl,
          clientState.webservices
        );
        const isClientAuthenticated = await client.isAuthenticated();
        if (!isClientAuthenticated) {
          await deauthCallback();
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
        const { hme, label, elementId, inputElementXPath } =
          message.data as ReservationRequestData;
        const client = await constructClient();
        // Given that the reservation step happens shortly after
        // the generation step, it is safe to assume that the client's
        // auth state has been recently validated. Hence, we are
        // skipping token validation.
        try {
          const pms = new PremiumMailSettings(client);
          const reservedHme = await pms.reserveHme(hme, label);
          await sendMessageToTab(MessageType.ReservationResponse, {
            hme,
            elementId,
            inputElementXPath,
          });
          // Store the XPath in the HmeEmail object for later use
          await setBrowserStorageValue(
            `hme_xpath_${reservedHme.hme}`,
            inputElementXPath
          );
        } catch (e) {
          await sendMessageToTab(MessageType.ReservationResponse, {
            error: e.toString(),
            elementId,
          });
        }
      }
      break;
    case MessageType.StoreXPath:
      {
        const { hme, xpath } = message.data as StoreXPathData;
        await setBrowserStorageValue(`hme_xpath_${hme}`, xpath);
      }
      break;
    default:
      break;
  }
});

// ===== Context menu =====

const setupContextMenu = async () => {
  const options =
    (await getBrowserStorageValue('iCloudHmeOptions')) ||
    DEFAULT_STORE.iCloudHmeOptions;

  browser.contextMenus.create(
    {
      id: CONTEXT_MENU_ITEM_ID,
      title: LOADING_COPY,
      contexts: ['editable'],
      enabled: false,
      visible: options.autofill.contextMenu,
    },
    async () => {
      const client = await constructClient();
      const isAuthenticated = await client.isAuthenticated();
      if (isAuthenticated) {
        performAuthSideEffects(client);
      } else {
        performDeauthSideEffects();
      }
    }
  );
};

// At any given time, there should be 1 created context menu item. We want to prevent
// the creation of multiple items that serve the same purpose (i.e. the context menu having multiple
// "Generate and reserve Hide My Email address" rows). We also want to prevent the lack of creation of one.
// Chromium persists the context menu state across browser restarts. Hence in Chromium, the context menu item is
// created once in the lifecycle of the extenstion's installation.
// On Firefox though, the context menu state is not persisted across browser restarts, meaning that the menu item
// will disappear once the user exits their browser session. For this reason, on Firefox, we create the context
// menu item each time the background script is loaded.
browser.runtime.onInstalled.addListener(setupContextMenu);

type OptionsStorageChange = {
  [K in keyof browser.Storage.StorageChange]: browser.Storage.StorageChange[K] extends unknown
    ? Options
    : browser.Storage.StorageChange[K];
};

// The following callback detects changes in the autofill config of the user
// and acts accordingly. In particular:
// * it hides the context menu item when the user un-checks the context menu option.
// * it makes the context menu item visible when the user checks the context menu option.
browser.storage.onChanged.addListener((changes, namespace) => {
  const iCloudHmeOptions = changes['iCloudHmeOptions' as keyof Store];
  if (namespace !== 'local' || iCloudHmeOptions === undefined) {
    return;
  }

  const { oldValue, newValue } = iCloudHmeOptions as OptionsStorageChange;

  if (oldValue?.autofill.contextMenu === newValue?.autofill.contextMenu) {
    // No change has been made to the context menu autofilling config.
    // There is no need to create or remove a context menu item.
    return;
  }

  browser.contextMenus
    .update(CONTEXT_MENU_ITEM_ID, {
      visible: newValue?.autofill.contextMenu,
    })
    .catch(console.debug);
});

// Upon clicking on the context menu item, we generate an email, reserve it, and emit it back to the content script
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ITEM_ID) {
    return;
  }

  // Show loading state in the right input
  sendMessageToTab(
    MessageType.Autofill,
    {
      data: LOADING_COPY,
    } as AutofillData,
    tab
  );

  const serializedUrl = info.pageUrl || tab?.url;
  const hostname = serializedUrl ? new URL(serializedUrl).hostname : '';

  const client = await constructClient();
  const isClientAuthenticated = await client.isAuthenticated();

  if (!isClientAuthenticated) {
    sendMessageToTab(
      MessageType.Autofill,
      {
        data: SIGNED_OUT_CTA_COPY,
      } as AutofillData,
      tab
    );
    performDeauthSideEffects();
    return;
  }

  try {
    const pms = new PremiumMailSettings(client);
    const hme = await pms.generateHme();
    await pms.reserveHme(hme, hostname);

    // Send the generated email to the same input
    await sendMessageToTab(
      MessageType.Autofill,
      {
        data: hme,
      } as AutofillData,
      tab
    );
  } catch (e) {
    sendMessageToTab(
      MessageType.Autofill,
      {
        data: e.toString(),
      } as AutofillData,
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
      performAuthSideEffects(client, { notification: true });
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
        performAuthSideEffects(client, { notification: true });
      } else {
        performDeauthSideEffects();
      }
    }
  }
);

// Present the user with a getting-started guide.
browser.runtime.onInstalled.addListener(
  async (details: browser.Runtime.OnInstalledDetailsType) => {
    const userguideUrl = browser.runtime.getURL('userguide.html');

    if (details.reason === 'install') {
      chrome.tabs.create({ url: userguideUrl }).then(console.debug);
    }
  }
);

// On Firefox the context menu state is not persisted across browser restarts, meaning that the menu item
// will disappear once the user quits their browser. Hence on Firefox, we create the context
// menu item each time the background script is loaded.
isFirefox && setupContextMenu();
