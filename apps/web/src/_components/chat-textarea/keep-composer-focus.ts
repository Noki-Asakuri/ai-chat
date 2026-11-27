import type { MouseEvent } from "react";

/**
 * Stops a tap on a composer button from moving focus off the editor. On phones that keeps the
 * keyboard open, so the screen and the composer don't jump under the finger between press and
 * release. The button still gets its click.
 */
export function keepComposerFocus(event: MouseEvent): void {
  event.preventDefault();
}
