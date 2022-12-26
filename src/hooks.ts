import { Dispatch, useEffect, useState } from 'react';
import isEqual from 'lodash.isequal';
import { getBrowserStorageValue, setBrowserStorageValue } from './storage';

export function useBrowserStorageState<T>(
  keys: string[],
  fallback: T
): [T, Dispatch<T>] {
  const [state, setState] = useState(fallback);

  useEffect(() => {
    async function getBrowserStorageState() {
      const value = await getBrowserStorageValue<T>(keys);

      value !== undefined &&
        setState((prevState) =>
          isEqual(prevState, value) ? prevState : value
        );
    }

    getBrowserStorageState().catch(console.error);
  }, [keys]);

  const setBrowserStorageState = async (value: T) => {
    setState(value);
    await setBrowserStorageValue(keys, value);
  };

  return [state, setBrowserStorageState];
}
