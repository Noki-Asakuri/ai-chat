import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type FocusEvent } from "react";

import {
  animateComposerFrom,
  measureComposer,
  prefersReducedMotion,
  type ComposerSnapshot,
} from "./composer-flip";

import { useChatStore } from "@/lib/store/chat-store";

const EDITOR_SELECTOR = "[data-composer]";
const OPEN_POPUP_SELECTOR = '[aria-expanded="true"], [data-popup-open]';

function isFileInput(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && target.type === "file";
}

/**
 * Tracks whether the phone composer is expanded. It expands when the input gets focus or holds
 * text or attachments, and collapses once focus leaves the composer while it is empty.
 *
 * Opening a file picker takes focus from the page, so the composer keeps its layout while one is
 * open. When the picker closes, focus goes back to the input if it was there before, so the
 * composer neither collapses nor needs another tap to keep typing.
 *
 * The layout is measured right before each switch and animated from there after React renders
 * the new one. On wider screens the layout does not change, so nothing animates.
 */
export function useComposerExpanded() {
  const ref = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  // Only the first value matters; later changes go through update() so the layout is measured first.
  const initialExpanded = useChatStore(hasComposerContent);
  const expandedRef = useRef(initialExpanded);
  const snapshotRef = useRef<ComposerSnapshot | null>(null);
  const [expanded, setExpanded] = useState(initialExpanded);
  const pickerRef = useRef<{ refocus: boolean } | null>(null);

  function update() {
    const next = isFocusedRef.current || hasComposerContent(useChatStore.getState());
    if (next === expandedRef.current) return;

    if (ref.current && !prefersReducedMotion()) {
      snapshotRef.current = measureComposer(ref.current);
    }

    expandedRef.current = next;
    setExpanded(next);
  }

  const onStoreChange = useEffectEvent(update);
  useEffect(() => useChatStore.subscribe(() => onStoreChange()), []);

  const onPickerOpen = useEffectEvent((event: Event) => {
    if (!isFileInput(event.target)) return;
    pickerRef.current = { refocus: isFocusedRef.current };
  });

  const onPickerClose = useEffectEvent((event: Event) => {
    const picker = pickerRef.current;
    if (!isFileInput(event.target) || !picker) return;

    // Wait for the input's own change handler to add the files, so the layout is decided once.
    requestAnimationFrame(() => {
      pickerRef.current = null;
      const container = ref.current;
      if (picker.refocus && container && !container.contains(document.activeElement)) {
        container.querySelector<HTMLElement>(EDITOR_SELECTOR)?.focus({ preventScroll: true });
      }

      // The browser can refuse to focus outside a tap; then the composer is no longer focused.
      isFocusedRef.current = !!container?.contains(document.activeElement);
      update();
    });
  });

  // The file inputs live inside the composer. `cancel` doesn't bubble, so listen while capturing.
  useEffect(() => {
    const container = ref.current;
    if (!container) return undefined;

    const open = (event: Event) => onPickerOpen(event);
    const close = (event: Event) => onPickerClose(event);
    container.addEventListener("click", open, true);
    container.addEventListener("change", close, true);
    container.addEventListener("cancel", close, true);

    return () => {
      container.removeEventListener("click", open, true);
      container.removeEventListener("change", close, true);
      container.removeEventListener("cancel", close, true);
    };
  }, []);

  // Runs after every render, but only animates when update() left a snapshot for this switch.
  useLayoutEffect(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot || !ref.current) return;

    snapshotRef.current = null;
    animateComposerFrom(ref.current, snapshot);
  });

  function onFocusCapture(event: FocusEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest(EDITOR_SELECTOR)) {
      // A browser that never reports the picker closing must not keep the layout pinned.
      pickerRef.current = null;
      isFocusedRef.current = true;
      update();
    }
  }

  function onBlurCapture(event: FocusEvent<HTMLDivElement>) {
    const container = ref.current;
    const next = event.relatedTarget;
    if (!container || (next instanceof Node && container.contains(next))) return;

    // Focus moves to menus rendered in a portal; wait a frame and keep the layout while one is open,
    // so the model picker does not jump away from its anchor. The same goes for a file picker.
    requestAnimationFrame(() => {
      if (pickerRef.current) return;
      if (container.contains(document.activeElement)) return;
      if (container.querySelector(OPEN_POPUP_SELECTOR)) return;
      isFocusedRef.current = false;
      update();
    });
  }

  return { ref, expanded, onFocusCapture, onBlurCapture };
}

function hasComposerContent(state: { input: string; attachments: readonly unknown[] }): boolean {
  return state.input.trim().length > 0 || state.attachments.length > 0;
}
