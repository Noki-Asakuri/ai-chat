import { useEffect, useEffectEvent } from "react";

export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  callback: (event: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions,
): void {
  const onEvent = useEffectEvent(callback);

  useEffect(
    function subscribe() {
      function listener(event: WindowEventMap[K]) {
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
