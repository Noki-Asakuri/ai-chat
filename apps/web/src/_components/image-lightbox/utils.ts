import type { NavigationDirection } from "./types";

export function extractNameFromUrl(url: string): string | undefined {
  const path = url.split(/[?#]/)[0] ?? url;
  const name = path.split("/").at(-1);
  return name || undefined;
}

export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  const mod = index % length;
  return mod < 0 ? mod + length : mod;
}

export function getShortestNavigationDirection(
  currentIndex: number,
  nextIndex: number,
  length: number,
): NavigationDirection {
  if (length <= 1 || currentIndex === nextIndex) return 0;

  const forwardSteps = (nextIndex - currentIndex + length) % length;
  const backwardSteps = (currentIndex - nextIndex + length) % length;

  if (forwardSteps === backwardSteps) {
    return nextIndex > currentIndex ? 1 : -1;
  }

  return forwardSteps < backwardSteps ? 1 : -1;
}
