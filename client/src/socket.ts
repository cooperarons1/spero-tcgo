import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';
import { auth } from './firebase';
import { PLATFORM, SERVER_URL } from './config';

// On iOS we use direct REST auth (Firebase JS SDK hangs in WKWebView), so
// the websocket can't ask `auth.currentUser.getIdToken()` — there's no
// Firebase user. Read the token persisted by useAuth instead.
function readIosIdToken(): string | null {
  try {
    const raw = localStorage.getItem('spero.tcg.restToken.v1');
    if (!raw) return null;
    const t = JSON.parse(raw);
    return typeof t?.idToken === 'string' ? t.idToken : null;
  } catch { return null; }
}

export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,   // never stop trying
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 45000,                   // 45s connection timeout
  transports: ['websocket', 'polling'],
  auth: async (cb) => {
    if (PLATFORM === 'ios') {
      const tok = readIosIdToken();
      cb(tok ? { token: tok } : {});
      return;
    }
    const user = auth.currentUser;
    if (user) {
      cb({ token: await user.getIdToken(true) }); // force refresh token on reconnect
    } else {
      cb({});
    }
  },
});

// Reactive `connected` flag for UI surfaces that want to indicate when the
// websocket handshake is in progress (Cloud Run cold start can stretch the
// first connect past 10 seconds — without feedback it looks like the app is
// stuck). Mirrors `socket.connected` and updates on connect/disconnect.
export function useSocketConnected(): boolean {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);
  return connected;
}
