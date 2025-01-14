import browser from 'webextension-polyfill';

export enum MessageType {
  Autofill,
  GenerateRequest,
  GenerateResponse,
  ReservationRequest,
  ReservationResponse,
  ActiveInputElementWrite,
  StoreXPath,
}

export type Message<T> = {
  type: MessageType;
  data: T;
};

export type AutofillData = {
  data: string;
  inputElementXPath?: string;
};

export type ReservationRequestData = {
  hme: string;
  label: string;
  elementId: string;
  inputElementXPath: string;
};

export type GenerationResponseData = {
  hme?: string;
  elementId: string;
  error?: string;
};

export type ActiveInputElementWriteData = {
  text: string;
  copyToClipboard: boolean;
  targetElementXPath?: string;
};

export type ReservationResponseData = GenerationResponseData & {
  inputElementXPath?: string;
};

export type StoreXPathData = {
  hme: string;
  xpath: string;
};

export const sendMessageToTab = async (
  type: MessageType,
  data: unknown,
  tab?: browser.Tabs.Tab
): Promise<void> => {
  if (tab === undefined) {
    [tab] = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
  }

  if (tab?.id !== undefined) {
    await browser.tabs.sendMessage(tab.id, {
      type,
      data,
    });
  }
};
