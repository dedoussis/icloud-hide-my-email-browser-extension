import browser from 'webextension-polyfill';
import { SignedOutAction } from './pages/Popup/stateMachine';

export enum MessageType {
  Autofill,
  LogInRequest,
  LogInResponse,
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

export type LogInRequestData = {
  email: string;
  password: string;
};

export type LogInResponseData = {
  success: boolean;
  action?: SignedOutAction;
};

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
