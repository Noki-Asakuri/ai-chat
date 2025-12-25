import { useEffect, useEffectEvent } from "react";

export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  callback: (event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): void;

export function useWindowEvent<E extends Event = Event>(
  type: string,
  callback: (event: E) => void,
  options?: boolean | AddEventListenerOptions,
): void;

export function useWindowEvent(
  type: string,
  callback: (event: Event) => void,
  options?: boolean | AddEventListenerOptions,
): void {
  const onEvent = useEffectEvent(callback);

  useEffect(
    function subscribe() {
      if (typeof window === "undefined") return;

      function listener(event: Event) {
        onEvent(event);
      }

      window.addEventListener(type, listener, options);

      return function unsubscribe() {
        window.removeEventListener(type, listener, options);
      };
    },
    [type, options],
  );
}
