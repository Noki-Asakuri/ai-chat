const BOTTOM_ATTACH_THRESHOLD_PX = 40;
const BOTTOM_DETACH_THRESHOLD_PX = 180;

let stickyToBottom = true;

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
