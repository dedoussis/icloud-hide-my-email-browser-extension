import { HmeEmail, ListHmeResult } from './iCloudClient';
import { getBrowserStorageValue, setBrowserStorageValue } from './storage';

export type HmeCache = {
  hmeEmails: HmeEmail[];
  selectedForwardTo: string;
  forwardToEmails: string[];
  cachedAt: number;
};

export async function getCachedHmeList(): Promise<HmeCache | undefined> {
  return getBrowserStorageValue('hmeCache');
}

export async function setCachedHmeList(
  result: ListHmeResult
): Promise<HmeCache> {
  const cache: HmeCache = {
    ...result,
    cachedAt: Date.now(),
  };
  await setBrowserStorageValue('hmeCache', cache);
  return cache;
}


export async function addCachedHmeEmail(hme: HmeEmail): Promise<void> {
  const cache = await getCachedHmeList();
  if (!cache) return;

  cache.hmeEmails = [hme, ...cache.hmeEmails];
  await setBrowserStorageValue('hmeCache', cache);
}

export async function clearHmeCache(): Promise<void> {
  await setBrowserStorageValue('hmeCache', undefined);
}
