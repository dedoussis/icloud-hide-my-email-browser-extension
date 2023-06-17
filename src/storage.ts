import browser from 'webextension-polyfill';

export const POPUP_STATE_STORAGE_KEYS = ['iCloudHmePopupState'];
export const SESSION_DATA_STORAGE_KEYS = ['iCloudHmeClientSession'];
export const OPTIONS_STORAGE_KEYS = ['iCloudHmeOptions'];

export async function getBrowserStorageValue<T>(
  keys: string[]
): Promise<T | undefined> {
  return keys.reduce((prev, curr) => {
    if (prev === undefined) {
      return undefined;
    }
    return prev[curr];
  }, await browser.storage.local.get(keys)) as unknown as T | undefined;
}

export async function setBrowserStorageValue(
  keys: string[],
  value: unknown
): Promise<void> {
  const mutableKeys = [...keys];
  const lastKey = mutableKeys.pop();
  if (lastKey === undefined) {
    throw Error('keys array must contain at least 1 element.');
  }

  const browserStorageObj = mutableKeys
    .reverse()
    .reduce((prev, curr) => ({ [curr]: prev }), { [lastKey]: value });

  await browser.storage.local.set(browserStorageObj);
}
