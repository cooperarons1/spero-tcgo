import { io } from 'socket.io-client';
import { auth } from './firebase';

const SERVER_URL = import.meta.env.DEV
  ? 'http://localhost:3002'
  : (import.meta.env.VITE_SERVER_URL || 'https://spero-tcgo-server-798283664658.us-west1.run.app');

export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,   // never stop trying
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 45000,                   // 45s connection timeout
  transports: ['websocket', 'polling'],
  auth: async (cb) => {
    const user = auth.currentUser;
    if (user) {
      cb({ token: await user.getIdToken(true) }); // force refresh token on reconnect
    } else {
      cb({});
    }
  },
});
