import { useEffect, useEffectEvent, useState } from "react";

/**
 * Local text for an input whose real value lives in the URL. Typing updates the draft at once and
 * commits it after a short pause, because a URL change waits on a navigation: binding the input to the
 * URL alone would drop keystrokes made while that navigation is still in flight.
 * A URL change the input didn't send (Clear all, the back button) replaces the draft.
 */
export function useDraftValue(value: string, onCommit: (next: string) => void, delay = 200) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [sent, setSent] = useState(value);

  if (value !== seen) {
    setSeen(value);
    if (value !== sent) {
      setSent(value);
      setDraft(value);
    }
  }

  const commit = useEffectEvent(onCommit);
  useEffect(() => {
    if (draft === sent) return undefined;
    const timer = window.setTimeout(() => {
      setSent(draft);
      commit(draft);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, draft, sent]);

  return [draft, setDraft] as const;
}
