// Capacitor wraps the Vite-built React client into an iOS app distributed
// via the App Store. Game server stays on Cloud Run; assets stay on Firebase
// Hosting (referenced via `assetUrl()` in client/src/config.ts).
//
// `webDir` points at the client production bundle. After every code change:
//   1. npm run build:client      (generates client/dist/)
//   2. npx cap sync ios          (copies client/dist into ios/App/App/public/)
//   3. open ios/App/App.xcworkspace + Cmd-R in Xcode (or `npx cap run ios`)
//
// `iosScheme: 'https'` makes WKWebView serve from `https://localhost` instead
// of `capacitor://localhost`. This keeps cookies + service workers behaving
// identically to the production web build, and avoids origin-mismatch
// surprises with Firebase Auth.
//
// `contentInset: 'always'` instructs the WKWebView to respect iOS safe areas
// — combined with the `viewport-fit=cover` meta + `env(safe-area-inset-*)`
// CSS variables we already added in Phase 1, this means the GameBoard will
// not paint under the iPhone notch or home indicator.

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aronslabs.mirotcg',
  appName: 'Miro TCG',
  webDir: 'client/dist',
  ios: {
    contentInset: 'always',
    scheme: 'https',
  },
  // No `server.url` — bundled mode. Pointing this at a remote URL would let
  // the app live-reload from a dev server, but it would ALSO change the
  // origin and break Cloud Run CORS. Keep bundled.
  server: {
    iosScheme: 'https',
    androidScheme: 'https',
  },
};

export default config;
