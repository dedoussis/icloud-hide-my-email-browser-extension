import { Dispatch, useEffect, useState } from 'react';
import isEqual from 'lodash.isequal';
import { getChromeStorageValue, setChromeStorageValue } from './storage';

export function useChromeStorageState<T>(
  keys: string[],
  fallback: T
): [T, Dispatch<T>] {
  const [state, setState] = useState(fallback);

  useEffect(() => {
    async function getChromeStorageState() {
      const value = await getChromeStorageValue<T>(keys);

      value !== undefined &&
        setState((prevState) =>
          isEqual(prevState, value) ? prevState : value
        );
    }

    getChromeStorageState().catch(console.error);
  }, [keys]);

  const setChromeStorageState = async (value: T) => {
    setState(value);
    await setChromeStorageValue(keys, value);
  };

  return [state, setChromeStorageState];
}
