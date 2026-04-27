# npm audit — open advisories (post Phase 5 polish, 2026-04-27)

Snapshot of `npm audit` after `npm audit fix` was applied (postcss bumped). 13 remaining advisories — all require `--force` (breaking) upgrades. Triaged below; none are runtime-exposed to end users.

## Why not `npm audit fix --force`

Three forced upgrades, each with non-trivial blast radius:

- `electron@33 → 41` — eight major versions, breaking API changes possible (we use `app`, `BrowserWindow`, `session`, `shell` — stable, but Chromium engine bumps may surface CSS / performance regressions in the game).
- `@capacitor/cli@6 → 8` — Capacitor 8 ships breaking config + plugin changes; we'd need to verify all plugins still resolve.
- `electron-builder@25 → 26` — builder config keys may have moved.

We pinned the current versions because the .dmg / iOS sync builds reproducibly on this machine. Bumping is a real-world test cycle, not a security emergency for our threat model. Upgrade is scheduled for v1.1, not blocking v1 launch.

## Open advisories — by package

### `electron <= 39.8.4` (high) — runtime, but mitigated

Advisory list: ASAR Integrity Bypass, AppleScript injection on macOS, Service Worker IPC spoofing, iframe permission origin confusion, OOB read in second-instance IPC, etc.

Why not blocking:
- We enable Electron's strongest mitigations: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` (all set in `electron/main.ts`).
- We ship a strict CSP via `session.webRequest.onHeadersReceived` (`electron/main.ts`) blocking inline scripts from untrusted origins.
- Most affected features are unused: no offscreen rendering, no `setAsDefaultProtocolClient`, no USB device selection, no second-instance IPC.
- For Steam distribution, the binary runs inside Steam's own sandbox — Steam can constrain what it sees.
- Threat actors can't reach these vectors without first executing code in our renderer, which the CSP prevents.

Action: upgrade to electron@41 in v1.1 cycle. Test: `npm run dev:electron` boots, `npm run build:electron-mac` produces working .dmg.

### `tar <= 7.5.10` (high) — build-time only

Affected paths: `cacache` (npm cache internals) and `@capacitor/cli` (extracts plugin tarballs during `cap add`/`cap sync`).

Why not blocking:
- These run at our build/dev time, not in the shipped client or server.
- Exploitation requires extracting attacker-controlled archives — we extract only npm-registry-signed tarballs from packages we explicitly added.
- An attacker who could swap our npm tarballs has already won; tar path traversal isn't the marginal vector.

Action: bump alongside `@capacitor/cli@8` upgrade in v1.1.

### `@tootallnate/once` chain (low, 2 advisories) — build-time only

Transitive via `electron-builder → app-builder-lib → @electron/rebuild → node-gyp → make-fetch-happen → http-proxy-agent → @tootallnate/once`. Used to fetch native module rebuild caches during electron-builder packaging.

Why not blocking:
- Pure build-pipeline dep, never linked into client or server.
- "Incorrect Control Flow Scoping" requires specific code patterns that the calling chain doesn't use.

Action: bump alongside `electron-builder@26` upgrade in v1.1.

## Re-audit cadence

After each Phase / dep change:
```
npm audit
```

After major version bumps planned for v1.1:
```
npm audit fix --force   # only after manually verifying each upgrade
npm run build:client && npm run build:electron-mac && npm run build:ios
```

If a *runtime* (client- or server-shipped) dep ever surfaces a high/critical advisory, bump immediately — those reach end users.
