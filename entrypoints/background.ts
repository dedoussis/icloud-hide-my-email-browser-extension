import type { Browser } from 'wxt/browser';
import {
  getBrowserStorageValue,
  setBrowserStorageValue,
  DEFAULT_STORE,
  Options,
} from '@/src/storage';
import ICloudClient, {
  PremiumMailSettings,
  DEFAULT_SETUP_URL,
  CN_SETUP_URL,
} from '@/src/iCloudClient';
import {
  ActiveInputElementWriteData,
  Message,
  MessageType,
  ReservationRequestData,
  sendMessageToTab,
} from '@/src/messages';
import {
  CONTEXT_MENU_ITEM_ID,
  LOADING_COPY,
  NOTIFICATION_MESSAGE_COPY,
  NOTIFICATION_TITLE_COPY,
  SIGNED_IN_CTA_COPY,
  SIGNED_OUT_CTA_COPY,
} from '@/src/constants';
import { isFirefox } from '@/src/browserUtils';

export default defineBackground(() => {
  const constructClient = async (): Promise<ICloudClient> => {
    const clientState = await getBrowserStorageValue('clientState');
    if (clientState === undefined) {
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
    if (notification) {
      browser.notifications
        .create({
          type: 'basic',
          title: NOTIFICATION_TITLE_COPY,
          message: NOTIFICATION_MESSAGE_COPY,
          iconUrl: 'icon-128.png',
        })
        .catch(console.debug);
    }
  };

  // ===== Message handling =====

  browser.runtime.onMessage.addListener(async (uncastedMessage: unknown) => {
    const message = uncastedMessage as Message<unknown>;

    switch (message.type) {
      case MessageType.GenerateRequest:
        {
          const elementId = message.data;
          const deauthCallback = async () => {
            await sendMessageToTab(MessageType.GenerateResponse, {
              error: SIGNED_OUT_CTA_COPY,
              elementId,
            });
            performDeauthSideEffects();
          };

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
              error: e instanceof Error ? e.message : String(e),
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
          try {
            const pms = new PremiumMailSettings(client);
            await pms.reserveHme(hme, label);
            await sendMessageToTab(MessageType.ReservationResponse, {
              hme,
              elementId,
            });
          } catch (e) {
            await sendMessageToTab(MessageType.ReservationResponse, {
              error: e instanceof Error ? e.message : String(e),
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

  browser.runtime.onInstalled.addListener(setupContextMenu);

  type OptionsStorageChange = {
    [K in keyof Browser.storage.StorageChange]: Browser.storage.StorageChange[K] extends unknown
      ? Options
      : Browser.storage.StorageChange[K];
  };

  browser.storage.onChanged.addListener((changes, namespace) => {
    const iCloudHmeOptions = changes['iCloudHmeOptions' as keyof typeof changes];
    if (namespace !== 'local' || iCloudHmeOptions === undefined) {
      return;
    }

    const { oldValue, newValue } = iCloudHmeOptions as OptionsStorageChange;

    if (oldValue?.autofill.contextMenu === newValue?.autofill.contextMenu) {
      return;
    }

    browser.contextMenus
      .update(CONTEXT_MENU_ITEM_ID, {
        visible: newValue?.autofill.contextMenu,
      })
      .catch(console.debug);
  });

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
          text: e instanceof Error ? e.message : String(e),
          copyToClipboard: false,
        } as ActiveInputElementWriteData,
        tab
      );
    }
  });

  // ===== Auth state sync =====

  browser.webRequest.onResponseStarted.addListener(
    async (details: Browser.webRequest.OnResponseStartedDetails) => {
      const { statusCode, url } = details;
      if (statusCode < 200 || statusCode > 299) {
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

  browser.webRequest.onResponseStarted.addListener(
    async (details: Browser.webRequest.OnResponseStartedDetails) => {
      const { statusCode } = details;
      if (statusCode < 200 || statusCode > 299) {
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

  browser.runtime.onInstalled.addListener(
    async (details: Browser.runtime.InstalledDetails) => {
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

  browser.runtime.onInstalled.addListener(
    async (details: Browser.runtime.InstalledDetails) => {
      const userguideUrl = browser.runtime.getURL('/userguide.html');
      if (details.reason === 'install') {
        browser.tabs.create({ url: userguideUrl }).then(console.debug);
      }
    }
  );

  if (isFirefox) {
    setupContextMenu();
  }
});
