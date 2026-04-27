// Miro TCG — Electron entry point for the Steam build.
//
// In dev (ELECTRON_DEV=1) we point the BrowserWindow at the running Vite dev
// server (http://localhost:5173) so HMR works. In a packaged build we load
// the static client bundle from ../client/dist/index.html, which Vite has
// already produced via `npm run build:client`.
//
// Game state still lives on the Cloud Run server — the client connects to
// `https://spero-tcgo-server-...run.app` (or whatever VITE_SERVER_URL was set
// to at build time). Asset URLs route through `assetUrl()` in client/src/config.ts
// which prefixes them with the Firebase Hosting CDN when running here.

import { app, BrowserWindow, net, protocol, session, shell } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const isDev = process.env.ELECTRON_DEV === '1';

// CSP only applies to https:// loads (the Vite dev server in dev mode, and
// any future remote URL). We deliberately do NOT enforce CSP on file://
// renderer pages — the production renderer loads index.html via loadFile()
// and CSP `'self'` against a file:// origin doesn't match the loaded scripts
// reliably across Electron versions, which would render a blank page.
//
// Renderer hardening for file:// pages comes from BrowserWindow webPreferences
// instead: contextIsolation: true, sandbox: true, nodeIntegration: false.
// Those block the actual exploit paths (renderer escaping its sandbox to run
// node code) regardless of CSP.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.web.app https://*.firebaseapp.com https://*.googleusercontent.com",
  "media-src 'self' blob: https://*.web.app",
  "connect-src 'self' https://*.run.app wss://*.run.app https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.web.app",
  "frame-src 'none'",
].join('; ');

function applyCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    // Only attach CSP to HTTP(S) responses. file:// gets no CSP — Vite's
    // built bundle uses dynamic imports and inline scripts that can't be
    // CSP-allowlisted against a file:// origin without going `unsafe-inline`
    // on script-src AND adding file:// to default-src, which defeats the
    // point of CSP. Renderer hardening lives in webPreferences.
    if (details.url.startsWith('http://') || details.url.startsWith('https://')) {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [CSP],
        },
      });
    } else {
      cb({ responseHeaders: details.responseHeaders });
    }
  });
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#1a0f05',
    title: 'Miro TCG',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The renderer talks to Cloud Run over wss; webSecurity must stay on.
      webSecurity: true,
    },
    // Show the window immediately. The previous `show: false` + ready-to-show
    // pattern leaves the user staring at the dock with no feedback if the
    // renderer errors before first paint — and made the window appear "missing"
    // when DevTools opened detached. The 1a0f05 backgroundColor masks the
    // pre-paint flash.
    show: true,
  });

  // External links (e.g. a future "Open Discord" button) open in the user's
  // default browser, not inside the Electron window. Without this they'd
  // hijack the game window and there's no back button to return.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    await win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Load via the custom `app://` protocol registered below instead of
    // loadFile()/file://. With file:// loading, absolute paths in React
    // (`<img src="/cards/X.webp">`, `/heroes/X.webp`, etc.) resolve to
    // the OS filesystem root and 404. With app://localhost as the origin,
    // those same absolute paths route into the bundled client/dist
    // through our protocol handler — no per-component path rewrites.
    await win.loadURL('app://localhost/index.html');
  }

  // Cmd-Opt-I (mac) / Ctrl-Shift-I (win/linux) toggles DevTools in any build
  // so users can self-diagnose connection / asset issues. No prod harm —
  // the renderer is sandboxed; DevTools is read-only inspection.
  win.webContents.on('before-input-event', (_event, input) => {
    const isToggle = input.key === 'I' && (input.alt || input.shift) && (input.meta || input.control);
    if (isToggle && input.type === 'keyDown') {
      win.webContents.toggleDevTools();
    }
  });

  // Surface uncaught renderer errors to the main-process log so headless
  // bug reports include something useful.
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer crash]', details);
  });
}

// Custom `app://` protocol — must be registered as standard + secure BEFORE
// app.whenReady so BrowserWindow can use it as a renderer origin without
// CORS/cookie quirks. Registration is a no-op cost in dev (we still load
// from http://localhost:5173) but harmless to keep unconditional.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

app.whenReady().then(() => {
  // Map app://localhost/<path> requests to the packaged client/dist tree.
  // electron-builder copies client/dist into the asar root at app/client/dist
  // (per package.json `build.files`), so __dirname (electron/dist inside the
  // asar) → ../../client/dist is the right anchor in both dev and prod.
  const distRoot = path.resolve(__dirname, '..', '..', 'client', 'dist');
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    // Drop leading slash + strip query/hash; default to index.html for the
    // SPA root so `app://localhost/` works as well as `app://localhost/index.html`.
    let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (!pathname || pathname.endsWith('/')) pathname += 'index.html';
    const filePath = path.join(distRoot, pathname);
    // Defense against path traversal — the resolved file must stay under
    // distRoot. `..` segments would let a renderer compromise read arbitrary
    // host files via `app://localhost/../../etc/passwd`.
    if (!filePath.startsWith(distRoot)) {
      return new Response('forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  applyCsp();
  void createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

// Quit when all windows are closed, except on macOS where staying alive in
// the dock is the platform convention.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
