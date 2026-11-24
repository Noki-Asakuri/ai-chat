/**
 * FLIP animation for the phone composer switching between its collapsed and expanded layouts.
 *
 * The composer is anchored to the bottom of the screen, so its height and its items are
 * measured relative to the composer itself. Animating the height and each item's offset with
 * the same timing then moves every item along a straight line on screen.
 */

type Offset = { x: number; y: number };

export type ComposerSnapshot = {
  height: number;
  items: Map<Element, Offset>;
};

const DURATION_MS = 220;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const ANIMATION_ID = "composer-flip";

export function measureComposer(container: HTMLElement): ComposerSnapshot {
  const box = container.getBoundingClientRect();
  const items = new Map<Element, Offset>();

  for (const item of container.children) {
    const rect = item.getBoundingClientRect();
    // Hidden items (display: none) have an empty box; they fade in if they appear.
    if (rect.width === 0 && rect.height === 0) continue;

    items.set(item, { x: rect.left - box.left, y: rect.top - box.top });
  }

  return { height: box.height, items };
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function animateComposerFrom(container: HTMLElement, before: ComposerSnapshot): void {
  cancelComposerAnimations(container);

  const after = measureComposer(container);
  const options: KeyframeAnimationOptions = { id: ANIMATION_ID, duration: DURATION_MS, easing: EASING };

  if (before.height !== after.height) {
    container.animate([{ height: `${before.height}px` }, { height: `${after.height}px` }], options);
  }

  for (const [item, offset] of after.items) {
    const previous = before.items.get(item);

    if (!previous) {
      item.animate(
        [
          { opacity: 0, transform: "translateY(4px)" },
          { opacity: 1, transform: "none" },
        ],
        options,
      );
      continue;
    }

    const dx = previous.x - offset.x;
    const dy = previous.y - offset.y;
    if (dx === 0 && dy === 0) continue;

    item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], options);
  }
}

function cancelComposerAnimations(container: HTMLElement): void {
  for (const animation of container.getAnimations({ subtree: true })) {
    if (animation.id === ANIMATION_ID) animation.cancel();
  }
}
