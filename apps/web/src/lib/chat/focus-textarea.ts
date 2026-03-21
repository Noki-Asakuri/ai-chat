export function focusTextareaAtEnd(textarea: HTMLTextAreaElement): void {
  textarea.focus({ preventScroll: true });

  const end = textarea.value.length;
  textarea.setSelectionRange(end, end);
}

export function focusTextareaByIdAtEnd(textareaId: string): void {
  const textarea = document.getElementById(textareaId);
  if (!(textarea instanceof HTMLTextAreaElement)) return;

  focusTextareaAtEnd(textarea);
}
