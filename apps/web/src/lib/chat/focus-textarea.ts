import { getComposerController } from "./composer-tokens";

export function focusTextareaAtEnd(textarea: HTMLTextAreaElement): void {
  textarea.focus({ preventScroll: true });

  const end = textarea.value.length;
  textarea.setSelectionRange(end, end);
}

export function focusTextareaByIdAtEnd(textareaId: string): void {
  const composer = getComposerController(textareaId);
  if (composer) {
    composer.focus({ at: "end" });
    return;
  }

  const textarea = document.getElementById(textareaId);
  if (!(textarea instanceof HTMLTextAreaElement)) return;

  focusTextareaAtEnd(textarea);
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLInputElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
