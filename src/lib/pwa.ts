/**
 * PWA service worker registration with iframe/preview guards.
 * Only registers in production builds running on real hosts (not Lovable preview).
 */
export function registerPWA() {
  if (typeof window === "undefined") return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const hostname = window.location.hostname;
  const isPreviewHost =
    hostname.includes("id-preview--") ||
    hostname.includes("lovableproject.com") ||
    hostname.includes("lovable.app") === false && hostname.includes("lovable") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1";

  // In preview/iframe, aggressively unregister any existing service workers
  if (isPreviewHost || isInIframe) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
    return;
  }

  // Production: dynamically import the virtual register module
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          // Check for updates every hour
          if (registration) {
            setInterval(() => registration.update(), 60 * 60 * 1000);
          }
        },
      });
    })
    .catch(() => {
      // virtual module not available (dev) — ignore
    });
}
