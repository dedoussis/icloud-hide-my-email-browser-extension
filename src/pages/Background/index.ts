import 'regenerator-runtime/runtime.js';
import fetchAdapter from '@vespaiach/axios-fetch-adapter';
import { getChromeStorageValue } from '../../hooks';
import ICloudClient, {
  ICloudClientSession,
  ICloudClientSessionData,
  PremiumMailSettings,
} from '../../iCloudClient';
import { MessageType, sendMessageToActiveTab } from '../../messages';

const getClient = async (): Promise<ICloudClient> => {
  const sessionData = (await getChromeStorageValue<ICloudClientSessionData>([
    'iCloudHmeClientSession',
  ])) || {
    headers: {},
    webservices: {},
    dsInfo: {},
  };

  const clientSession = new ICloudClientSession(sessionData, (data) => {});
  const client = new ICloudClient(clientSession, { adapter: fetchAdapter });
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
