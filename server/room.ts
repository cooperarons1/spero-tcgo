import type { Room, GameState } from '../shared/types.js';

const rooms = new Map<string, Room>();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

export function createRoom(hostId: string, hostName: string): Room {
  const code = generateCode();
  const room: Room = {
    code,
    hostId,
    game: null,
    players: new Map([[hostId, hostName]]),
  };
  rooms.set(code, room);
  return room;
}

export function joinRoom(code: string, playerId: string, playerName: string): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.game) return null; // can't join mid-game
  if (room.players.size >= 2) return null; // max 2 players
  room.players.set(playerId, playerName);
  return room;
}

export function getRoom(code: string): Room | null {
  return rooms.get(code.toUpperCase()) ?? null;
}

export function getRoomByPlayer(playerId: string): Room | null {
  for (const room of rooms.values()) {
    if (room.players.has(playerId)) return room;
  }
  return null;
}

export function removePlayer(playerId: string): Room | null {
  const room = getRoomByPlayer(playerId);
  if (!room) return null;
  room.players.delete(playerId);
  if (room.players.size === 0) {
    rooms.delete(room.code);
  }
  return room;
}
