const BOTTOM_ATTACH_THRESHOLD_PX = 40;
const BOTTOM_DETACH_THRESHOLD_PX = 180;
const MIN_PROGRAMMATIC_SCROLL_INTERVAL_MS = 32;
const STICKY_RESIZE_AUTO_SCROLL_SUPPRESSION_MS = 250;
const STICKY_RESIZE_AUTO_SCROLL_SUPPRESSION_CYCLES = 3;

let stickyToBottom = true;
let scrollRafId: number | null = null;
let pendingBehavior: ScrollBehavior | null = null;
let lastProgrammaticScrollAt = 0;
let stickyResizeAutoScrollSuppressedUntil = 0;
let stickyResizeAutoScrollSuppressionCycles = 0;

export function getBottomThresholdPx(): number {
  return BOTTOM_ATTACH_THRESHOLD_PX;
}

export function getStickyToBottom(): boolean {
  return stickyToBottom;
}

export function setStickyToBottom(next: boolean): void {
  stickyToBottom = next;
}

export function suppressStickyResizeAutoScroll(): void {
  stickyResizeAutoScrollSuppressedUntil = Date.now() + STICKY_RESIZE_AUTO_SCROLL_SUPPRESSION_MS;
  stickyResizeAutoScrollSuppressionCycles = Math.max(
    stickyResizeAutoScrollSuppressionCycles,
    STICKY_RESIZE_AUTO_SCROLL_SUPPRESSION_CYCLES,
  );
}

export function consumeStickyResizeAutoScrollSuppression(): boolean {
  if (stickyResizeAutoScrollSuppressionCycles <= 0) {
    return false;
  }

  if (Date.now() > stickyResizeAutoScrollSuppressedUntil) {
    stickyResizeAutoScrollSuppressionCycles = 0;
    stickyResizeAutoScrollSuppressedUntil = 0;
    return false;
  }

  stickyResizeAutoScrollSuppressionCycles -= 1;

  if (stickyResizeAutoScrollSuppressionCycles === 0) {
    stickyResizeAutoScrollSuppressedUntil = 0;
  }

  return true;
}

export function getMessagesScrollAreaElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>("#messages-scrollarea");
}

export function computeIsAtBottom(element: HTMLElement): boolean {
  const distanceFromBottom = element.scrollHeight - (element.scrollTop + element.clientHeight);

  if (stickyToBottom) {
    return distanceFromBottom <= BOTTOM_DETACH_THRESHOLD_PX;
  }

  return distanceFromBottom <= BOTTOM_ATTACH_THRESHOLD_PX;
}

export function updateStickyToBottomFromScroll(element: HTMLElement): boolean {
  const next = computeIsAtBottom(element);
  stickyToBottom = next;
  return next;
}

export function scrollToBottom(element: HTMLElement, behavior: ScrollBehavior): void {
  element.scrollTo({ top: element.scrollHeight, behavior });
}

export function scrollToBottomIfSticky(element: HTMLElement, behavior: ScrollBehavior): void {
  if (!stickyToBottom) return;
  scrollToBottom(element, behavior);
}

export function scrollToBottomIfStickyRaf(element: HTMLElement, behavior: ScrollBehavior): void {
  if (!stickyToBottom) return;

  pendingBehavior = behavior;

  if (scrollRafId !== null) return;

  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null;

    if (!stickyToBottom) {
      pendingBehavior = null;
      return;
    }

    const now = performance.now();
    if (now - lastProgrammaticScrollAt < MIN_PROGRAMMATIC_SCROLL_INTERVAL_MS) {
      if (scrollRafId === null) {
        scrollRafId = requestAnimationFrame(() => {
          scrollRafId = null;
          if (!stickyToBottom) {
            pendingBehavior = null;
            return;
          }

          const queuedBehavior = pendingBehavior ?? behavior;
          pendingBehavior = null;
          scrollToBottom(element, queuedBehavior);
          lastProgrammaticScrollAt = performance.now();
        });
      }

      return;
    }

    const queuedBehavior = pendingBehavior ?? behavior;
    pendingBehavior = null;
    scrollToBottom(element, queuedBehavior);
    lastProgrammaticScrollAt = now;
  });
}
