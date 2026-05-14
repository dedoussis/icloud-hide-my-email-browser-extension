import { browser } from 'wxt/browser';
import ICloudClient from './iCloudClient';
import { PopupState } from './popupState';
import { HmeCache } from './hmeCache';

export type Autofill = {
  button: boolean;
  contextMenu: boolean;
};

export type Options = {
  autofill: Autofill;
};

export type Store = {
  popupState: PopupState;
  iCloudHmeOptions: Options;
  clientState?: {
    setupUrl: ConstructorParameters<typeof ICloudClient>[0];
    webservices: ConstructorParameters<typeof ICloudClient>[1];
  };
  hmeCache?: HmeCache;
};

export const DEFAULT_STORE = {
  popupState: PopupState.SignedOut,
  iCloudHmeOptions: {
    autofill: {
      button: true,
      contextMenu: true,
    },
  },
  clientState: undefined,
};

export async function getBrowserStorageValue<K extends keyof Store>(
  key: K
): Promise<Store[K] | undefined> {
  const store: Partial<Store> = await browser.storage.local.get(key);
  return store[key];
}

export async function setBrowserStorageValue<K extends keyof Store>(
  key: K,
  value: Store[K]
): Promise<void> {
  if (value === undefined) {
    await browser.storage.local.remove(key);
  } else {
    await browser.storage.local.set({ [key]: value });
  }
}
