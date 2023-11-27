import 'regenerator-runtime/runtime.js';
import fetchAdapter from '@vespaiach/axios-fetch-adapter';
import {
  getBrowserStorageValue,
  POPUP_STATE_STORAGE_KEYS,
  SESSION_DATA_STORAGE_KEYS,
  OPTIONS_STORAGE_KEYS,
  setBrowserStorageValue,
} from '../../storage';
import ICloudClient, {
  ClientAuthenticationError,
  EMPTY_SESSION_DATA,
  ICloudClientSession,
  ICloudClientSessionData,
  PremiumMailSettings,
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
import { Options } from '../../options';

if (!('declarativeNetRequest' in browser)) {
  setupBlockingWebRequestListeners();
}

const getClient = async (withTokenValidation = true): Promise<ICloudClient> => {
  const sessionData =
    (await getBrowserStorageValue<ICloudClientSessionData>(
      SESSION_DATA_STORAGE_KEYS
    )) || EMPTY_SESSION_DATA;

  const clientSession = new ICloudClientSession(
    sessionData,
    async (data) =>
      await setBrowserStorageValue(SESSION_DATA_STORAGE_KEYS, data)
  );

  const client = new ICloudClient(clientSession, { adapter: fetchAdapter });

  if (withTokenValidation && client.authenticated) {
    try {
      await client.validateToken();
    } catch {
      await signOut(client);
    }
  }
  return client;
};

// ===== Message handling =====

browser.runtime.onMessage.addListener(async (message: Message<unknown>) => {
  switch (message.type) {
    case MessageType.GenerateRequest:
      {
        const elementId = message.data;
        const client = await getClient();
        if (!client.authenticated) {
          await sendMessageToTab(MessageType.GenerateResponse, {
            error: SIGNED_OUT_CTA_COPY,
            elementId,
          });
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
        const client = await getClient(false);
        if (!client.authenticated) {
          await sendMessageToTab(MessageType.GenerateResponse, {
            error: SIGNED_OUT_CTA_COPY,
            elementId,
          });
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
      visible: options?.autofill.contextMenu || false,
    },
    async () => {
      const client = await getClient();
      if (!client.authenticated) {
        browser.contextMenus
          .update(CONTEXT_MENU_ITEM_ID, {
            title: SIGNED_OUT_CTA_COPY,
            enabled: false,
          })
          .catch(console.debug);
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
      visible: newValue?.autofill.contextMenu || false,
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

  const client = await getClient();
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
    if (e instanceof ClientAuthenticationError) {
      browser.contextMenus
        .update(CONTEXT_MENU_ITEM_ID, {
          title: SIGNED_OUT_CTA_COPY,
          enabled: false,
        })
        .catch(console.debug);

      sendMessageToTab(
        MessageType.ActiveInputElementWrite,
        {
          text: SIGNED_OUT_CTA_COPY,
          copyToClipboard: false,
        } as ActiveInputElementWriteData,
        tab
      );
    } else {
      sendMessageToTab(
        MessageType.ActiveInputElementWrite,
        {
          text: e.toString(),
          copyToClipboard: false,
        } as ActiveInputElementWriteData,
        tab
      );
    }
    return;
  }
});

browser.webRequest.onResponseStarted.addListener(
  async (details: browser.WebRequest.OnResponseStartedDetailsType) => {
    const { responseHeaders, url, statusCode } = details;
    if (!responseHeaders || (statusCode < 199 && statusCode > 300)) {
      return;
    }

    const headers = new Headers();
    if (responseHeaders) {
      responseHeaders.forEach(({ name, value }) => {
        if (value !== undefined) {
          headers.append(name, value);
        }
      });
    }

    const client = await getClient(false);
    const clientWasAuthenticated = client.authenticated;

    await client.populateAndPersistSessionHeaders(headers);

    if (
      url.startsWith(
        `${ICloudClient.DEFAULT_BASE_URL_CONFIG.setup}/accountLogin`
      )
    ) {
      await client.validateToken(true).catch(console.debug);

      if (!clientWasAuthenticated && client.authenticated) {
        browser.notifications
          .create({
            type: 'basic',
            title: 'iCloud HideMyEmail Extension',
            message: 'The iCloud HideMyEmail extension is ready to use!',
            iconUrl: 'icon-128.png',
          })
          .catch(console.debug);

        browser.contextMenus
          .update(CONTEXT_MENU_ITEM_ID, {
            title: SIGNED_IN_CTA_COPY,
            enabled: true,
          })
          .catch(console.debug);
      }
    }
  },
  {
    urls: [
      `${ICloudClient.DEFAULT_BASE_URL_CONFIG.auth}/*`,
      `${ICloudClient.DEFAULT_BASE_URL_CONFIG.setup}/accountLogin*`,
    ],
  },
  ['responseHeaders']
);

browser.webRequest.onResponseStarted.addListener(
  async (details: browser.WebRequest.OnResponseStartedDetailsType) => {
    const { statusCode } = details;
    if (statusCode < 199 && statusCode > 300) {
      return;
    }

    const client = await getClient(false);
    signOut(client);
  },
  {
    urls: [`${ICloudClient.DEFAULT_BASE_URL_CONFIG.setup}/logout*`],
  },
  ['responseHeaders']
);

const signOut = async (client: ICloudClient) => {
  await client.resetSession();
  await setBrowserStorageValue(POPUP_STATE_STORAGE_KEYS, PopupState.SignedOut);

  browser.contextMenus
    .update(CONTEXT_MENU_ITEM_ID, {
      title: SIGNED_OUT_CTA_COPY,
      enabled: false,
    })
    .catch(console.debug);
};
