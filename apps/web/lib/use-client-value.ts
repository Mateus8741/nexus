import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Valor que só existe no browser (hora local, user agent…) sem mismatch de
 * hidratação: no servidor/hidratação devolve `serverValue`, depois o real.
 */
export function useClientValue<T>(getter: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribe, getter, () => serverValue);
}
