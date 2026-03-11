import * as React from "react";

export function useThrottledDebouncedValue<T>(value: T, delayMs: number): T {
  const [renderValue, setRenderValue] = React.useState<T>(value);
  const lastExecutedRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (delayMs <= 0) {
      lastExecutedRef.current = Date.now();
      setRenderValue(value);
      return;
    }

    const now = Date.now();
    const elapsed = now - lastExecutedRef.current;

    if (elapsed >= delayMs) {
      lastExecutedRef.current = now;
      setRenderValue(value);
      return;
    }

    const remaining = delayMs - elapsed;

    // Throttle high-frequency updates to avoid excessive syntax highlighting work.
    const timeoutId = setTimeout(() => {
      lastExecutedRef.current = Date.now();
      setRenderValue(value);
    }, remaining);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delayMs]);

  return renderValue;
}
