import {
  Dispatch,
  useEffect,
  useState,
  SetStateAction,
  useCallback,
} from 'react';
import isEqual from 'lodash.isequal';
import {
  getBrowserStorageValue,
  setBrowserStorageValue,
  Store,
} from './storage';

export function useBrowserStorageState<K extends keyof Store>(
  key: K,
  fallback: NonNullable<Store[K]>
): [NonNullable<Store[K]>, Dispatch<SetStateAction<NonNullable<Store[K]>>>] {
  const [state, setState] = useState(fallback);

  useEffect(() => {
    async function getBrowserStorageState() {
      const value = await getBrowserStorageValue(key);

      value !== undefined &&
        setState((prevState) =>
          isEqual(prevState, value) ? prevState : value
        );
    }

    getBrowserStorageState().catch(console.error);
  }, [key]);

  const setBrowserStorageState = useCallback(
    (
      value:
        | NonNullable<Store[K]>
        | ((prevState: NonNullable<Store[K]>) => NonNullable<Store[K]>)
    ) =>
      setState((prevState) => {
        const newValue = value instanceof Function ? value(prevState) : value;
        setBrowserStorageValue(key, newValue);
        return newValue;
      }),
    [key]
  );

  return [state, setBrowserStorageState];
}
