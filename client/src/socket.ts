import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.DEV
  ? 'http://localhost:3002'
  : (import.meta.env.VITE_SERVER_URL || 'https://spero-tcgo-server-383160804961.us-west1.run.app');

export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket', 'polling'],
  auth: async (cb) => {
    const { auth } = await import('./firebase');
    const user = auth.currentUser;
    if (user) {
      cb({ token: await user.getIdToken() });
    } else {
      cb({});
    }
  },
});
