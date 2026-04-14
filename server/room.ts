import type { Room, GameState } from '../shared/types.js';

const rooms = new Map<string, Room>();
const playerToRoom = new Map<string, string>(); // uid → roomCode (O(1) lookup)
const disconnectedPlayers = new Map<string, { roomCode: string; timer: ReturnType<typeof setTimeout> }>();

const RECONNECT_GRACE_MS = 120_000; // 2 minutes

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
  playerToRoom.set(uid, code);
  return room;
}

export function joinRoom(code: string, uid: string, socketId: string, name: string): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.game) return null;
  if (room.players.size >= 2) return null;
  room.players.set(uid, name);
  room.sockets.set(uid, socketId);
  playerToRoom.set(uid, room.code);
  return room;
}

export function getRoom(code: string): Room | null {
  return rooms.get(code.toUpperCase()) ?? null;
}

export function getRoomByPlayer(uid: string): Room | null {
  const code = playerToRoom.get(uid);
  if (!code) return null;
  return rooms.get(code) ?? null;
}

/** Mark a player as disconnected with a reconnect grace period.
 *  `onGracePeriodExpired` is called if the player doesn't reconnect in time —
 *  use it to set a winner, write match history, and notify the remaining player. */
export function markDisconnected(uid: string, onGracePeriodExpired?: (room: Room, disconnectedUid: string) => void): Room | null {
  const room = getRoomByPlayer(uid);
  if (!room) return null;

  // If game is in progress, set grace period instead of removing
  if (room.game && !room.game.winner) {
    const timer = setTimeout(() => {
      // Grace period expired — notify caller, then remove the player
      disconnectedPlayers.delete(uid);
      if (onGracePeriodExpired && room.game && !room.game.winner) {
        onGracePeriodExpired(room, uid);
      }
      removePlayer(uid);
    }, RECONNECT_GRACE_MS);
    disconnectedPlayers.set(uid, { roomCode: room.code, timer });
    return room;
  }

  // No active game — remove immediately
  return removePlayer(uid);
}

/** Attempt to reconnect a player — returns the room if successful */
export function tryReconnect(uid: string, newSocketId: string): Room | null {
  const dc = disconnectedPlayers.get(uid);
  if (!dc) return null;

  const room = rooms.get(dc.roomCode);
  if (!room) {
    disconnectedPlayers.delete(uid);
    clearTimeout(dc.timer);
    return null;
  }

  // Restore socket mapping
  room.sockets.set(uid, newSocketId);
  clearTimeout(dc.timer);
  disconnectedPlayers.delete(uid);
  return room;
}

/** Check if a player is in disconnected grace period */
export function isDisconnected(uid: string): boolean {
  return disconnectedPlayers.has(uid);
}

export function removePlayer(uid: string): Room | null {
  const room = getRoomByPlayer(uid);
  if (!room) return null;
  room.players.delete(uid);
  room.sockets.delete(uid);
  playerToRoom.delete(uid);
  // Clean up any pending disconnect timer
  const dc = disconnectedPlayers.get(uid);
  if (dc) {
    clearTimeout(dc.timer);
    disconnectedPlayers.delete(uid);
  }
  if (room.players.size === 0) {
    rooms.delete(room.code);
  }
  return room;
}

/** Check if any player in this room has an active disconnect grace period */
export function hasActiveGracePeriod(room: Room): boolean {
  for (const uid of room.players.keys()) {
    if (disconnectedPlayers.has(uid)) return true;
  }
  return false;
}

export function cleanupStaleRooms(): void {
  for (const [code, room] of rooms) {
    if (room.players.size === 0) {
      // Skip rooms where disconnected players still have active grace periods
      // (their uid may no longer be in players but the timer references this room)
      let hasGrace = false;
      for (const [, dc] of disconnectedPlayers) {
        if (dc.roomCode === code) { hasGrace = true; break; }
      }
      if (hasGrace) continue;
      clearRoomTimer(room);
      rooms.delete(code);
    }
  }
}
