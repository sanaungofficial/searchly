import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function getIsMobile() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
  mql.addEventListener("change", onStoreChange);
  window.addEventListener("resize", onStoreChange);
  return () => {
    mql.removeEventListener("change", onStoreChange);
    window.removeEventListener("resize", onStoreChange);
  };
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getIsMobile, () => false);
}

export { MOBILE_BREAKPOINT, MOBILE_MEDIA_QUERY };
