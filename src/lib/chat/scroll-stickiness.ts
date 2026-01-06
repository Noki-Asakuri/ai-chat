const BOTTOM_THRESHOLD_PX = 24;

let stickyToBottom = true;

export function getBottomThresholdPx(): number {
  return BOTTOM_THRESHOLD_PX;
}

export function getStickyToBottom(): boolean {
  return stickyToBottom;
}

export function setStickyToBottom(next: boolean): void {
  stickyToBottom = next;
}

export function getMessagesScrollAreaElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>("#messages-scrollarea");
}

export function computeIsAtBottom(element: HTMLElement): boolean {
  const distanceFromBottom = element.scrollHeight - (element.scrollTop + element.clientHeight);
  return distanceFromBottom <= BOTTOM_THRESHOLD_PX;
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