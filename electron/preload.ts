// Preload runs in the renderer process before any page script, but with
// access to a limited Node surface. We use it solely to expose a tiny
// `window.electronAPI` shim that the React app sniffs at runtime to detect
// the Steam/Electron build (see client/src/config.ts).
//
// contextIsolation is on in main.ts, so the renderer cannot otherwise see
// `process.versions.electron`. Anything the game needs from Node has to be
// surfaced explicitly here. Keep this file small and audit any addition —
// every export becomes part of the renderer's attack surface.

import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: 'steam' as const,
  electronVersion: process.versions.electron,
  // Reserved: future Steamworks IPC bridge (achievements, rich presence)
  // would expose typed methods here, e.g. setAchievement(id), setRichPresence({ key, value }).
});
