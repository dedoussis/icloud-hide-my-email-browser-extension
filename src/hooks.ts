import { Dispatch, useEffect, useState } from 'react';
import isEqual from 'lodash.isequal';

export function useChromeStorageState<T>(
  keys: string[],
  fallback: T
): [T, Dispatch<T>] {
  const [state, setState] = useState(fallback);

  useEffect(() => {
    async function getChromeStorageState() {
      const value = keys.reduce((prev, curr) => {
        if (prev === undefined || curr === undefined) {
          return undefined;
        }
        return prev[curr];
      }, await chrome.storage.local.get(keys)) as unknown as T;
      value !== undefined &&
        setState((prevState) => {
            console.log(prevState)
            console.log(value)
            console.log(isEqual(prevState, value))
            return isEqual(prevState, value) ? prevState : value
        }
        );
    }

    getChromeStorageState().catch(console.error);
  }, [keys]);

  const setChromeStorageState = async (value: T) => {
    setState(value);
    const chromeStorageObj: { [key: string]: any } = {};
    let curr = chromeStorageObj;
    keys.slice(0, -1).forEach((key) => {
      curr[key] = {};
      curr = curr[key];
    });
    curr[keys.at(-1) as string] = value;
    await chrome.storage.local.set(chromeStorageObj);
  };

  return [state, setChromeStorageState];
}
