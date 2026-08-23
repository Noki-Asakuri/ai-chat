import * as React from "react";

const MOBILE_BREAKPOINT = 1024;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribeToMobileQuery(onStoreChange: () => void): () => void {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerMobileSnapshot(): boolean {
  return false;
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribeToMobileQuery, getMobileSnapshot, getServerMobileSnapshot);
}
