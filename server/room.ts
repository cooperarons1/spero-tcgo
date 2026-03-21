import type { Room, GameState } from '../shared/types.js';

const rooms = new Map<string, Room>();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code: string;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

export function clearRoomTimer(room: Room): void {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

export function createRoom(uid: string, socketId: string, name: string): Room {
  const code = generateCode();
  const room: Room = {
    code,
    hostId: uid,
    game: null,
    players: new Map([[uid, name]]),
    sockets: new Map([[uid, socketId]]),
    timerInterval: null,
    rematchProposedBy: null,
    lastFirstPlayerIndex: null,
    selectedDecks: new Map(),
  };
  rooms.set(code, room);
  return room;
}

export function joinRoom(code: string, uid: string, socketId: string, name: string): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.game) return null;
  if (room.players.size >= 2) return null;
  room.players.set(uid, name);
  room.sockets.set(uid, socketId);
  return room;
}

export function getRoom(code: string): Room | null {
  return rooms.get(code.toUpperCase()) ?? null;
}

export function getRoomByPlayer(uid: string): Room | null {
  for (const room of rooms.values()) {
    if (room.players.has(uid)) return room;
  }
  return null;
}

export function removePlayer(uid: string): Room | null {
  const room = getRoomByPlayer(uid);
  if (!room) return null;
  room.players.delete(uid);
  room.sockets.delete(uid);
  if (room.players.size === 0) {
    rooms.delete(room.code);
  }
  return room;
}

export function cleanupStaleRooms(): void {
  for (const [code, room] of rooms) {
    if (room.players.size === 0) {
      clearRoomTimer(room);
      rooms.delete(code);
    }
  }
}
