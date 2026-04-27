// Central platform/URL config — single source of truth for which environment
// the client is running in (web, ios via Capacitor, steam via Electron) and
// where to fetch the game server + static assets.
//
// All call sites that previously hardcoded a URL should import from here so
// we can flip the asset CDN base or server URL in one spot when adding new
// distribution channels.
//
// Detection precedence: explicit env var > runtime sniff > web default.
// Native wrappers inject their own globals (Capacitor.platform, process.versions.electron)
// before any React code runs, so the runtime sniff is reliable for choosing
// platform-specific behavior at render time.

declare global {
  interface Window {
    Capacitor?: { getPlatform?: () => string };
    // Set by electron/preload.ts via contextBridge.exposeInMainWorld.
    // contextIsolation hides process.versions.electron from the renderer,
    // so this is the only reliable Electron sniff after the security
    // upgrade in the Electron shell.
    electronAPI?: { platform: 'steam'; electronVersion: string };
  }
}

export type Platform = 'web' | 'ios' | 'steam';

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'web';
  if (window.Capacitor?.getPlatform?.() === 'ios') return 'ios';
  if (window.electronAPI?.platform === 'steam') return 'steam';
  return 'web';
}

export const PLATFORM: Platform = detectPlatform();

// Game server (Cloud Run). DEV uses Vite proxy; native + prod web use the
// hardcoded Cloud Run URL unless VITE_SERVER_URL overrides it.
export const SERVER_URL: string = import.meta.env.DEV
  ? 'http://localhost:3002'
  : (import.meta.env.VITE_SERVER_URL ||
     'https://spero-tcgo-server-798283664658.us-west1.run.app');

// Asset base. Cards + heroes + frames are bundled into the app for both web
// (Firebase Hosting same-origin) and native builds (Capacitor sync copies
// client/dist into ios/App/App/public/, Electron loads via file://). Empty
// base ⇒ the WebView/WKWebView resolves /cards/X.webp against the current
// origin (https://localhost on iOS Capacitor, file:// on Electron prod).
//
// Earlier this was a CDN URL on iOS, which made every card image a network
// fetch — first launch had to download ~314 MB before any card could render
// and the app felt "stuck loading." Bundled-everywhere is faster and works
// offline. VITE_ASSET_BASE_URL still overrides for ad-hoc CDN tests.
export const ASSET_BASE_URL: string = (() => {
  const override = import.meta.env.VITE_ASSET_BASE_URL;
  if (override) return override;
  return '';
})();

/**
 * Resolve a static asset path to a full URL appropriate for the current
 * platform. Pass paths starting with `/` (e.g. `/cards/COIN.webp`).
 *
 * - Web: returns the path unchanged (browser resolves against current origin).
 * - iOS Capacitor: same — the WKWebView serves at https://localhost so
 *   absolute paths resolve into the bundled `public/` folder.
 * - Electron prod: file:// scheme means absolute `/cards/X.webp` would
 *   resolve to filesystem root (broken). Strip the leading slash so the
 *   path becomes relative to the loaded `index.html` — which sits next to
 *   the bundled `cards/` directory in the packaged app.
 *
 * VITE_ASSET_BASE_URL override wins for ad-hoc CDN tests.
 *
 * Idempotent: if `path` is already an absolute URL, it's returned unchanged.
 */
export function assetUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (ASSET_BASE_URL) {
    if (path.startsWith('/')) return ASSET_BASE_URL + path;
    return ASSET_BASE_URL + '/' + path;
  }
  // Electron prod uses the custom app:// protocol (registered in
  // electron/main.ts) — absolute `/cards/X.webp` resolves cleanly to the
  // bundled client/dist tree without any rewrite here.
  return path;
}
