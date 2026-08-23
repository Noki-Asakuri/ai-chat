import * as React from "react";

export function useThrottledDebouncedValue<T>(value: T, delayMs: number): T {
  const [renderValue, setRenderValue] = React.useState<T>(value);
  const lastExecutedRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (delayMs <= 0) return undefined;

    const now = Date.now();
    const elapsed = now - lastExecutedRef.current;
    const remaining = Math.max(0, delayMs - elapsed);

    // Throttle high-frequency updates to avoid excessive syntax highlighting work.
    const timeoutId = setTimeout(() => {
      lastExecutedRef.current = Date.now();
      setRenderValue(value);
    }, remaining);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delayMs]);

  return delayMs <= 0 ? value : renderValue;
}
