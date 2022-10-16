import 'regenerator-runtime/runtime.js';
import fetchAdapter from '@vespaiach/axios-fetch-adapter';
import {
  getChromeStorageValue,
  POPUP_STATE_STORAGE_KEYS,
  SESSION_DATA_STORAGE_KEYS,
  setChromeStorageValue,
} from '../../storage';
import ICloudClient, {
  EMPTY_SESSION_DATA,
  ICloudClientSession,
  ICloudClientSessionData,
  PremiumMailSettings,
} from '../../iCloudClient';
import { MessageType, sendMessageToActiveTab } from '../../messages';
import { PopupState } from '../Popup/Popup';

const getClient = async (
  withTokenValidation: boolean = true
): Promise<ICloudClient> => {
  const sessionData =
    (await getChromeStorageValue<ICloudClientSessionData>(
      SESSION_DATA_STORAGE_KEYS
    )) || EMPTY_SESSION_DATA;

  const clientSession = new ICloudClientSession(
    sessionData,
    async (data) => await setChromeStorageValue(SESSION_DATA_STORAGE_KEYS, data)
  );
  const client = new ICloudClient(clientSession, { adapter: fetchAdapter });

  if (withTokenValidation && client.authenticated) {
    try {
      await client.validateToken();
    } catch {
      await client.logOut();
      await setChromeStorageValue(
        POPUP_STATE_STORAGE_KEYS,
        PopupState.SignedOut
      );
    }
  }
  return client;
};

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.type) {
    case MessageType.GenerateRequest:
      {
        const elementId = message.data;
        const client = await getClient();
        if (!client.authenticated) {
          await sendMessageToActiveTab(MessageType.GenerateResponse, {
            error: 'Please sign-in to iCloud.',
            elementId,
          });
          break;
        }

        const pms = new PremiumMailSettings(client);
        try {
          const hme = await pms.generateHme();
          await sendMessageToActiveTab(MessageType.GenerateResponse, {
            hme,
            elementId,
          });
        } catch (e) {
          await sendMessageToActiveTab(MessageType.GenerateResponse, {
            error: e.toString(),
            elementId,
          });
        }
      }
      break;
    case MessageType.ReservationRequest:
      {
        const { hme, label, elementId } = message.data;
        const client = await getClient(false);
        if (!client.authenticated) {
          await sendMessageToActiveTab(MessageType.GenerateResponse, {
            error: 'Please sign-in to iCloud.',
            elementId,
          });
          break;
        }

        try {
          const pms = new PremiumMailSettings(client);
          await pms.reserveHme(hme, label);
          await sendMessageToActiveTab(MessageType.ReservationResponse, {
            hme,
            elementId,
          });
        } catch (e) {
          await sendMessageToActiveTab(MessageType.ReservationResponse, {
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
