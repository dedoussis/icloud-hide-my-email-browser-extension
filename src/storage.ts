import browser from 'webextension-polyfill';
import ICloudClient from './iCloudClient';
import { PopupState } from './pages/Popup/stateMachine';

export type Autofill = {
  button: boolean;
  contextMenu: boolean;
};

export type Options = {
  autofill: Autofill;
};

export const DEFAULT_OPTIONS: Options = {
  autofill: {
    button: true,
    contextMenu: true,
  },
};

export type Store = {
  popupState?: PopupState;
  iCloudHmeOptions?: Options; // TODO: rename key to options
  clientState?: ConstructorParameters<typeof ICloudClient>;
};

export async function getBrowserStorageValue<K extends keyof Store>(
  key: K
): Promise<Store[K] | undefined> {
  const store: Store = await browser.storage.local.get(key);
  return store[key];
}

export async function setBrowserStorageValue<K extends keyof Store>(
  key: K,
  value: Store[K]
): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}
