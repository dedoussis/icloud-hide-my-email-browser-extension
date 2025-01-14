import browser from 'webextension-polyfill';
import ICloudClient from './iCloudClient';
import { PopupState } from './pages/Popup/stateMachine';

export type Autofill = {
  button: boolean;
  contextMenu: boolean;
};

export type Options = {
  autofill: Autofill;
  theme?: 'light' | 'dark' | 'system';
};

export type Store = {
  popupState: PopupState;
  clientState?: {
    setupUrl: ICloudClient['setupUrl'];
    webservices?: ICloudClient['webservices'];
  };
  iCloudHmeOptions: Options;
  theme: 'light' | 'dark' | 'system';
} & {
  [K in `hme_xpath_${string}`]?: string;
} & {
  [K in `hme_target_${string}`]?: string;
} & {
  [key: string]: unknown;
};

export const DEFAULT_STORE = {
  popupState: PopupState.SignedOut,
  iCloudHmeOptions: {
    autofill: {
      button: true,
      contextMenu: true,
    },
  },
  theme: 'system',
  clientState: undefined,
};

export async function getBrowserStorageValue<K extends keyof Store>(
  key: K
): Promise<Store[K]>;
export async function getBrowserStorageValue(key: string): Promise<unknown>;
export async function getBrowserStorageValue(key: string): Promise<unknown> {
  const store = await browser.storage.local.get(key);
  return store[key];
}

export async function setBrowserStorageValue<K extends keyof Store>(
  key: K,
  value: Store[K]
): Promise<void>;
export async function setBrowserStorageValue(
  key: string,
  value: unknown
): Promise<void>;
export async function setBrowserStorageValue(
  key: string,
  value: unknown
): Promise<void> {
  if (value === undefined) {
    await browser.storage.local.remove(key);
  } else {
    await browser.storage.local.set({ [key]: value });
  }
}
