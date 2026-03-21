type SettingsDirection = "forward" | "backward";

type NavigationViewTransition = false | { types: string[] };

export const SETTINGS_ROUTE_ORDER = [
  "/settings/account",
  "/settings/threads",
  "/settings/customization",
  "/settings/statistics",
  "/settings/attachments",
  "/settings/models",
  "/settings/profiles",
] as const;

function matchesRoutePrefix(pathname: string, routePath: string): boolean {
  return pathname === routePath || pathname.startsWith(`${routePath}/`);
}

function isSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname === "/settings/" || pathname.startsWith("/settings/");
}

function isChatIndexPath(pathname: string): boolean {
  return pathname === "/" || pathname === "";
}

function isThreadPath(pathname: string): boolean {
  return pathname.startsWith("/threads/");
}

function isChatPath(pathname: string): boolean {
  return isChatIndexPath(pathname) || isThreadPath(pathname);
}

export function getSettingsRouteIndex(pathname: string): number | null {
  for (const [index, routePath] of SETTINGS_ROUTE_ORDER.entries()) {
    if (matchesRoutePrefix(pathname, routePath)) return index;
  }

  return null;
}

export function getSettingsDirection(
  fromPath: string,
  toPath: string,
): SettingsDirection | null {
  const fromIndex = getSettingsRouteIndex(fromPath);
  const toIndex = getSettingsRouteIndex(toPath);

  if (fromIndex === null || toIndex === null || fromIndex === toIndex) return null;
  return fromIndex < toIndex ? "forward" : "backward";
}

export function isSettingsTransition(fromPath: string, toPath: string): boolean {
  return getSettingsDirection(fromPath, toPath) !== null;
}

export function isChatEntryTransition(fromPath: string, toPath: string): boolean {
  if (!isChatPath(toPath)) return false;
  if (isThreadPath(fromPath) && isThreadPath(toPath)) return false;
  if (isChatIndexPath(fromPath) && isChatIndexPath(toPath)) return false;
  if (isSettingsPath(fromPath)) return true;
  if (isChatIndexPath(fromPath) && isThreadPath(toPath)) return true;

  return !isChatPath(fromPath);
}

export function shouldUseViewTransitions(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const canStartViewTransition =
    "startViewTransition" in document &&
    typeof document.startViewTransition === "function";

  if (!canStartViewTransition) return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function getNavigationViewTransition(
  fromPath: string,
  toPath: string,
): NavigationViewTransition {
  if (!shouldUseViewTransitions()) return false;

  const settingsDirection = getSettingsDirection(fromPath, toPath);
  if (settingsDirection) {
    return { types: ["settings", `settings-${settingsDirection}`] };
  }

  if (isChatEntryTransition(fromPath, toPath)) {
    return { types: ["chat", "chat-enter"] };
  }

  return false;
}
