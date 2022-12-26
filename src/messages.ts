import browser from 'webextension-polyfill';

export enum MessageType {
  Autofill,
  GenerateRequest,
  GenerateResponse,
  ReservationRequest,
  ReservationResponse,
}

export type Message<T> = {
  type: MessageType;
  data: T;
};

export type ReservationRequestData = {
  hme: string;
  label: string;
  elementId: string;
};

export type GenerationResponseData = {
  hme?: string;
  elementId: string;
  error?: string;
};

export type ReservationResponseData = GenerationResponseData;

export const sendMessageToActiveTab = async (
  type: MessageType,
  data: unknown
): Promise<void> => {
  const [tab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (tab.id !== undefined) {
    await browser.tabs.sendMessage(tab.id, {
      type,
      data,
    });
  }
};
