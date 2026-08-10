const MESSAGE_SELECTION_EVENT = "chat:message-selection";

export type MessageSelection = {
  text: string;
  x: number;
  y: number;
};

export function clearMessageSelection(): void {
  window.dispatchEvent(new CustomEvent<MessageSelection | null>(MESSAGE_SELECTION_EVENT, { detail: null }));
}

export function selectMessageText(
  contentElement: HTMLElement,
  eventTarget: EventTarget,
  clickCount: number,
  x: number,
  y: number,
): void {
  if (
    eventTarget instanceof Element &&
    eventTarget.closest("button, input, textarea, select, [contenteditable='true']")
  ) {
    clearMessageSelection();
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) {
    clearMessageSelection();
    return;
  }

  if (clickCount === 1) {
    const range = selection.getRangeAt(0);
    const contentRange = document.createRange();
    contentRange.selectNodeContents(contentElement);

    const startsInside = contentRange.isPointInRange(range.startContainer, range.startOffset);
    const endsInside = contentRange.isPointInRange(range.endContainer, range.endOffset);
    if (!startsInside || !endsInside) {
      clearMessageSelection();
      return;
    }
  }

  const text = selection.toString().trim();
  if (!text) {
    clearMessageSelection();
    return;
  }

  if (clickCount > 1 && !contentElement.innerText.includes(text)) {
    clearMessageSelection();
    return;
  }

  window.dispatchEvent(
    new CustomEvent<MessageSelection>(MESSAGE_SELECTION_EVENT, {
      detail: { text, x, y },
    }),
  );
}

export { MESSAGE_SELECTION_EVENT };
