# Miro TCG — Distribution Handoff

Reference for shipping Miro TCG via Web (existing), iOS (App Store via Capacitor), and Steam (via Electron). Most of this is operational — registries, signing certs, store submissions — that the codebase can't do for you.

## Platform matrix

| | Source | Wrapper | Distribution | Asset host |
|--|--|--|--|--|
| Web | `client/` Vite build | none | Firebase Hosting (`miro-tcgo.web.app`, future `mirotcg.com`) | same origin |
| iOS | `client/` Vite build | `ios/` (Capacitor) | App Store Connect → TestFlight → App Store | Firebase Hosting via `assetUrl()` |
| Steam | `client/` Vite build | `electron/` (Electron + electron-builder) | SteamPipe → Steam | Firebase Hosting via `assetUrl()` |

Game server: Cloud Run (`spero-tcgo-server`) — shared across all three platforms. No platform-specific server code.

## Build commands

```
npm run build:client         # web client → client/dist/
npm run build:electron-mac   # → dist/electron/Miro TCG-1.0.0(-arm64).dmg
npm run build:electron-win   # → dist/electron/Miro TCG Setup 1.0.0.exe (run on Win)
npm run build:electron-linux # → dist/electron/Miro TCG-1.0.0.AppImage
npm run build:ios            # vite build + cap sync → ios/App/App/public/
npm run open:ios             # opens Xcode workspace for signing + Archive
npm run dev:electron         # local Electron against Vite (needs dev:client running)
```

## iOS — App Store via TestFlight

Prereqs:
- Apple Developer Program membership ($99/yr) — done.
- Xcode logged in with the Apple ID that owns the program.
- CocoaPods installed (`brew install cocoapods`) — done.

First-time setup:
1. `npm run build:ios && npm run open:ios` — opens `ios/App/App.xcworkspace` in Xcode.
2. In Xcode → project navigator → "App" target → Signing & Capabilities → check "Automatically manage signing", select your Team. Bundle Identifier should already be `com.aronslabs.mirotcg`.
3. Plug in an iPhone (or use a simulator) and hit Cmd-R to verify the local build runs.
4. App Store Connect → My Apps → "+" → New App. Bundle ID = `com.aronslabs.mirotcg`. Fill metadata (name, description, screenshots at iPhone 6.7", 6.5", 5.5"; iPad 12.9" if supporting iPad).

Each release:
1. Bump `version` in `package.json`.
2. `npm run build:ios && npm run open:ios`.
3. Xcode → Product → Archive (must be on Real Device target, not simulator).
4. Organizer window pops → Distribute App → App Store Connect → Upload.
5. Wait for processing (~10 min). Then App Store Connect → TestFlight → invite testers OR submit for review.
6. First App Store review: 1–7 days. Subsequent: hours to a day.

Common gotchas:
- Privacy Manifest (`PrivacyInfo.xcprivacy`) is required as of iOS 17. Capacitor 6 generates a starter; review for accuracy before submission.
- Push notifications + IAP need separate App Store Connect setup. Defer until needed.
- TestFlight builds expire 90 days after upload — re-upload before then.

## Steam — Electron via Steam Direct

Prereqs:
- Steam Direct fee ($100 one-time per app) paid → app entry on partner.steampowered.com.
- Steamworks SDK downloaded (only needed if integrating achievements; safe to skip for v1).

First-time setup:
1. partner.steampowered.com → Apps → New App. Note the AppID (e.g. `1234567`).
2. Steamworks Settings → Application → set name, icons, store assets.
3. Build the depot — typically:
   ```
   steamcmd +login <username> +run_app_build_http path/to/app_build_<AppID>.vdf +quit
   ```
   Where `app_build_<AppID>.vdf` lives in `electron/steam-build/` (create on first release; template at https://partner.steamgames.com/doc/sdk/uploading).
4. Steamworks → Builds → set the "default" branch to your uploaded build.
5. **30-day cooldown** before the public store page can go live (Steam policy for new accounts).

Each release:
1. Bump `version` in `package.json`.
2. `npm run build:electron-mac && npm run build:electron-win && npm run build:electron-linux` (cross-build requires running on each OS or a CI matrix).
3. Upload via SteamPipe per the build script.
4. Push to a beta branch first (`beta_internal`) for tester verification, then promote to default.

Common gotchas:
- macOS Gatekeeper: the .dmg is signed with your dev cert but not notarized. For Steam this is fine (Steam launches inside its own sandbox). For direct downloads from a website, notarize via `electron-builder` config + Apple's `altool`.
- Electron auto-update: out of scope for v1 — Steam handles updates via depot uploads.
- Linux .AppImage runs on most distros; if Steam users complain about specific distros, add Snap or Flatpak builds.

## Custom domain (`mirotcg.com` or chosen)

Domain registration: ~$12/yr (Squarespace Domains, Cloudflare Registrar, Google Domains). Buy whatever you like — DNS is portable.

### Firebase Hosting (web client + asset CDN)

1. Firebase Console → spero-tcgo project → Hosting → Add custom domain → enter `mirotcg.com`.
2. Firebase shows TXT record to verify ownership + A records to point at Firebase's CDN. Add at registrar.
3. Wait for SSL provisioning (~15 min – 1 hour).
4. Firebase will serve the same `client/dist/` bundle on both `miro-tcgo.web.app` AND `mirotcg.com`. No code change needed for the web build.

### Cloud Run (game server)

1. Cloud Console → Cloud Run → spero-tcgo-server → Manage Custom Domains → add `api.mirotcg.com` (subdomain).
2. Add the CNAME shown at registrar.
3. Once SSL provisions, set `VITE_SERVER_URL=https://api.mirotcg.com` for production builds:
   - Web: edit `client/.env.production` (create if missing) with `VITE_SERVER_URL=https://api.mirotcg.com`, then `npm run build:client`.
   - Electron: same — env var read at Vite build time before `electron-builder` runs.
   - iOS: same — env var read at Vite build time before `cap sync`.

### CORS

After adding the domain, the Cloud Run server needs to allow it as a CORS origin:

1. Edit `.env.production.yaml`:
   ```yaml
   CORS_ORIGINS: https://mirotcg.com,https://www.mirotcg.com
   ```
2. `npm run deploy:server` — Cloud Run picks up the env var on next revision.

(Native wrappers — `capacitor://localhost`, `https://localhost`, `file://` — are already in the default whitelist in `server/index.ts`.)

### CSP

`firebase.json` has a Content-Security-Policy header that whitelists the Cloud Run URL. Update once the custom domain is live:

```json
"connect-src 'self' https://*.run.app wss://*.run.app https://*.mirotcg.com wss://*.mirotcg.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://www.googleapis.com"
```

Re-deploy hosting: `npm run deploy:client`.

## Secrets

- **No secrets in the repo.** The Firebase Admin SDK uses `applicationDefault()` (server/firebaseAdmin.ts), which reads the Cloud Run service account at runtime — no JSON key file to lose.
- **Google OAuth keys** (if/when added): Secret Manager. Reference from Cloud Run with `--update-secrets=ENV_NAME=secret-name:latest`.
- **`.env.production.yaml`** in this repo holds non-secret env vars (`NODE_ENV`, `CORS_ORIGINS`). It is safe to commit. Anything sensitive moves to Secret Manager.

## Cost summary

| | Recurring | One-time |
|--|--|--|
| Apple Developer | $99/yr | — |
| Steam Direct | — | $100/app |
| Domain | $12/yr | — |
| GCP | usage-based | — |
| Firebase Hosting | usage-based (Spark plan free tier covers small projects) | — |

## Release checklist

- [ ] `npm run test`
- [ ] Bump `version` in root `package.json` AND `client/package.json` (keep aligned)
- [ ] `npm run deploy:client` (web)
- [ ] `npm run deploy:server` (Cloud Run)
- [ ] `npm run build:electron-mac` / `-win` / `-linux` (Steam)
- [ ] `npm run build:ios && npm run open:ios` → Xcode Archive → upload (iOS)
- [ ] Tag git release: `git tag v1.0.0 && git push --tags`
