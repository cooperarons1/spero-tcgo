import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PLATFORM } from './config'

// Native iOS plugin init. Dynamic imports keep the web bundle clean — the
// modules are no-ops in browsers anyway, but tree-shaking can't always prove
// it, and this also avoids a dev-time console warning when Vite tries to
// resolve native-only deps. Bundlers see these as separate chunks that the
// web build will never load (PLATFORM === 'web').
if (PLATFORM === 'ios') {
  void import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    // White glyphs over the dark game gradient. Default light style would put
    // black time/battery icons on a near-black background.
    return StatusBar.setStyle({ style: Style.Dark });
  }).catch(() => { /* plugin missing → keep system default */ });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Hide the splash *after* React has rendered the gradient background so users
// see the game's own background, not a white flash. requestIdleCallback (or
// setTimeout fallback) gives the browser a tick to paint before we tell the
// native splash to fade.
if (PLATFORM === 'ios') {
  const hide = () => {
    void import('@capacitor/splash-screen').then(({ SplashScreen }) =>
      SplashScreen.hide({ fadeOutDuration: 250 })
    ).catch(() => { /* plugin missing → splash fades out via Info.plist default */ });
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(hide);
  } else {
    setTimeout(hide, 0);
  }
}
