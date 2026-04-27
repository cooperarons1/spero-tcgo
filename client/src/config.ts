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

// Asset CDN base. Web build serves assets from the same origin (empty base ⇒
// browser resolves /cards/X.webp against the host). Native wrappers don't
// have a useful "same origin" so they point at Firebase Hosting (or the
// future custom domain) for the ~700 MB card art library.
const DEFAULT_ASSET_BASE_NATIVE = 'https://miro-tcgo.web.app';

export const ASSET_BASE_URL: string = (() => {
  const override = import.meta.env.VITE_ASSET_BASE_URL;
  if (override) return override;
  if (PLATFORM === 'ios' || PLATFORM === 'steam') return DEFAULT_ASSET_BASE_NATIVE;
  return ''; // web: relative to current host
})();

/**
 * Resolve a static asset path to a full URL appropriate for the current
 * platform. Pass paths starting with `/` (e.g. `/cards/COIN.webp`).
 *
 * - Web: returns the path unchanged (browser resolves against current origin).
 * - Native: prefixes with the asset CDN so WKWebView / Electron fetches over
 *   HTTPS from Firebase Hosting instead of trying to load from the bundle.
 *
 * Idempotent: if `path` is already an absolute URL, it's returned unchanged.
 */
export function assetUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (!ASSET_BASE_URL) return path;
  if (path.startsWith('/')) return ASSET_BASE_URL + path;
  return ASSET_BASE_URL + '/' + path;
}
