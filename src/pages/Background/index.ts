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
  LogInRequestData,
  LogInResponseData,
  Message,
  MessageType,
  ReservationRequestData,
  sendMessageToTab,
} from '../../messages';
import {
  PopupState,
  SignedOutAction,
  STATE_MACHINE_TRANSITIONS,
} from '../Popup/stateMachine';
import browser from 'webextension-polyfill';
import { setupWebRequestListeners } from '../../webRequestUtils';
import { Options } from '../../options';

if (browser.webRequest !== undefined) {
  setupWebRequestListeners();
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
      await client.logOut();
      await setBrowserStorageValue(
        POPUP_STATE_STORAGE_KEYS,
        PopupState.SignedOut
      );
      browser.contextMenus
        .update(CONTEXT_MENU_ITEM_ID, {
          title: SIGNED_OUT_CTA_COPY,
          enabled: false,
        })
        .catch(console.debug);
    }
  }
  return client;
};

// ===== Message handling =====

browser.runtime.onMessage.addListener(async (message: Message<unknown>) => {
  switch (message.type) {
    case MessageType.LogInRequest:
      {
        const { email, password } = message.data as LogInRequestData;
        const client = await getClient(false);

        try {
          await client.signIn(email, password);
          await client.accountLogin();
        } catch (e) {
          await browser.runtime.sendMessage({
            type: MessageType.LogInResponse,
            data: { success: false },
          } as Message<LogInResponseData>);
          return;
        }

        const action: SignedOutAction = client.requires2fa
          ? 'SUCCESSFUL_SIGN_IN'
          : 'SUCCESSFUL_VERIFICATION';
        const newState =
          STATE_MACHINE_TRANSITIONS[PopupState.SignedOut][action];

        await setBrowserStorageValue(POPUP_STATE_STORAGE_KEYS, newState);
        await browser.runtime.sendMessage({
          type: MessageType.LogInResponse,
          data: { success: true, action },
        } as Message<LogInResponseData>);

        browser.contextMenus
          .update(CONTEXT_MENU_ITEM_ID, {
            title: SIGNED_IN_CTA_COPY,
            enabled: true,
          })
          .catch(console.debug);
      }
      break;
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

const createContextMenuItem = (): void => {
  browser.contextMenus.create(
    {
      id: CONTEXT_MENU_ITEM_ID,
      title: LOADING_COPY,
      contexts: ['editable'],
      enabled: false,
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
};

// At any given time, there should be <=1 created context menu items. We want to prevent
// the creation of multiple items that serve the same purpose (i.e. the context menu having multiple
// "Generate and reserve Hide My Email address" rows). Hence, we create the context menu item once,
// upon the installation of the extension.
browser.runtime.onInstalled.addListener(async () => {
  const options = await getBrowserStorageValue<Options>(OPTIONS_STORAGE_KEYS);

  if (!options?.autofill.contextMenu) {
    return;
  }

  createContextMenuItem();
});

// The following callback detects changes in the autofill config of the user
// and acts accordingly. In particular:
// * it removes the context menu item when the user un-checks the context menu option.
// * it creates a context menu item when the user checks the context menu option.
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

  if (newValue?.autofill.contextMenu === true) {
    createContextMenuItem();
  } else {
    browser.contextMenus.removeAll();
  }
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
      browser.contextMenus.update(CONTEXT_MENU_ITEM_ID, {
        title: SIGNED_OUT_CTA_COPY,
        enabled: false,
      }).catch(console.debug);

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
