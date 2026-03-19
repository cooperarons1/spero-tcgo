import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.DEV
  ? 'http://localhost:3002'
  : (import.meta.env.VITE_SERVER_URL || 'https://spero-tcgo-server-383160804961.us-west1.run.app');

export const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});
