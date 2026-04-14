import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  getRoom,
  getRoomByPlayer,
  removePlayer,
  isDisconnected,
  markDisconnected,
  tryReconnect,
  hasActiveGracePeriod,
  clearRoomTimer,
} from '../room.js';

// Room module uses global state. We create fresh rooms per test and
// clean up via removePlayer to keep tests isolated.

const uids: string[] = [];
function trackUid(uid: string) { uids.push(uid); return uid; }

beforeEach(() => { uids.length = 0; });
afterEach(() => {
  // Clean up all players we created
  for (const uid of uids) removePlayer(uid);
  vi.restoreAllMocks();
});

// ── Room creation ─────────────────────────────────────────────────

describe('createRoom', () => {
  it('returns a room with a 6-char code', () => {
    const room = createRoom(trackUid('host1'), 'sock1', 'Host');
    expect(room.code).toHaveLength(6);
    expect(room.code).toMatch(/^[A-Z]+$/);
  });

  it('host is in players and sockets', () => {
    const room = createRoom(trackUid('host2'), 'sock2', 'Host');
    expect(room.players.get('host2')).toBe('Host');
    expect(room.sockets.get('host2')).toBe('sock2');
  });

  it('game starts as null', () => {
    const room = createRoom(trackUid('host3'), 'sock3', 'Host');
    expect(room.game).toBeNull();
  });

  it('unique codes across multiple rooms', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const room = createRoom(trackUid(`u${i}`), `s${i}`, `P${i}`);
      codes.add(room.code);
    }
    expect(codes.size).toBe(50);
  });
});

// ── Join room ─────────────────────────────────────────────────────

describe('joinRoom', () => {
  it('second player can join', () => {
    const room = createRoom(trackUid('host4'), 'sock4', 'Host');
    const joined = joinRoom(room.code, trackUid('p2_4'), 'sock_p2', 'Player2');
    expect(joined).not.toBeNull();
    expect(joined!.players.size).toBe(2);
  });

  it('returns null for nonexistent code', () => {
    expect(joinRoom('ZZZZZZ', 'uid', 'sock', 'name')).toBeNull();
  });

  it('returns null when room is full', () => {
    const room = createRoom(trackUid('host5'), 'sock5', 'Host');
    joinRoom(room.code, trackUid('p2_5'), 'sock_p2', 'P2');
    const third = joinRoom(room.code, 'p3_5', 'sock_p3', 'P3');
    expect(third).toBeNull();
  });

  it('returns null when game is in progress', () => {
    const room = createRoom(trackUid('host6'), 'sock6', 'Host');
    room.game = {} as any; // mock game in progress
    const joined = joinRoom(room.code, 'p2_6', 'sock_p2', 'P2');
    expect(joined).toBeNull();
    room.game = null; // reset for cleanup
  });

  it('case-insensitive code matching', () => {
    const room = createRoom(trackUid('host7'), 'sock7', 'Host');
    const joined = joinRoom(room.code.toLowerCase(), trackUid('p2_7'), 'sock_p2', 'P2');
    expect(joined).not.toBeNull();
  });
});

// ── Lookup ────────────────────────────────────────────────────────

describe('getRoom', () => {
  it('finds room by code', () => {
    const room = createRoom(trackUid('host8'), 'sock8', 'Host');
    expect(getRoom(room.code)).toBe(room);
  });

  it('returns null for unknown code', () => {
    expect(getRoom('XXXXXX')).toBeNull();
  });

  it('case-insensitive', () => {
    const room = createRoom(trackUid('host9'), 'sock9', 'Host');
    expect(getRoom(room.code.toLowerCase())).toBe(room);
  });
});

describe('getRoomByPlayer', () => {
  it('finds room containing player', () => {
    const room = createRoom(trackUid('host10'), 'sock10', 'Host');
    expect(getRoomByPlayer('host10')).toBe(room);
  });

  it('returns null for unknown player', () => {
    expect(getRoomByPlayer('nobody')).toBeNull();
  });
});

// ── Remove player ─────────────────────────────────────────────────

describe('removePlayer', () => {
  it('removes player from room', () => {
    const room = createRoom(trackUid('host11'), 'sock11', 'Host');
    joinRoom(room.code, trackUid('p2_11'), 'sock_p2', 'P2');
    removePlayer('p2_11');
    expect(room.players.has('p2_11')).toBe(false);
    expect(room.players.size).toBe(1);
  });

  it('deletes room when last player leaves', () => {
    const room = createRoom(trackUid('host12'), 'sock12', 'Host');
    removePlayer('host12');
    expect(getRoom(room.code)).toBeNull();
  });

  it('returns null for unknown player', () => {
    expect(removePlayer('nobody')).toBeNull();
  });
});

// ── Disconnect / Reconnect ────────────────────────────────────────

describe('disconnect and reconnect', () => {
  it('isDisconnected is false by default', () => {
    createRoom(trackUid('host13'), 'sock13', 'Host');
    expect(isDisconnected('host13')).toBe(false);
  });

  it('markDisconnected without active game removes immediately', () => {
    const room = createRoom(trackUid('host14'), 'sock14', 'Host');
    markDisconnected('host14');
    expect(isDisconnected('host14')).toBe(false); // no grace period
    expect(getRoom(room.code)).toBeNull(); // room cleaned up
  });

  it('markDisconnected with active game sets grace period', () => {
    vi.useFakeTimers();
    const room = createRoom(trackUid('host15'), 'sock15', 'Host');
    joinRoom(room.code, trackUid('p2_15'), 'sock_p2', 'P2');
    room.game = { winner: null } as any; // mock active game
    markDisconnected('host15');
    expect(isDisconnected('host15')).toBe(true);
    vi.useRealTimers();
    // Cleanup
    room.game = null;
  });

  it('tryReconnect restores socket and clears disconnected state', () => {
    vi.useFakeTimers();
    const room = createRoom(trackUid('host16'), 'sock16', 'Host');
    joinRoom(room.code, trackUid('p2_16'), 'sock_p2', 'P2');
    room.game = { winner: null } as any;
    markDisconnected('host16');
    expect(isDisconnected('host16')).toBe(true);

    const reconnected = tryReconnect('host16', 'new-sock');
    expect(reconnected).toBe(room);
    expect(isDisconnected('host16')).toBe(false);
    expect(room.sockets.get('host16')).toBe('new-sock');
    vi.useRealTimers();
    room.game = null;
  });

  it('tryReconnect returns null if not disconnected', () => {
    createRoom(trackUid('host17'), 'sock17', 'Host');
    expect(tryReconnect('host17', 'new-sock')).toBeNull();
  });

  it('hasActiveGracePeriod detects disconnected players', () => {
    vi.useFakeTimers();
    const room = createRoom(trackUid('host18'), 'sock18', 'Host');
    joinRoom(room.code, trackUid('p2_18'), 'sock_p2', 'P2');
    room.game = { winner: null } as any;
    expect(hasActiveGracePeriod(room)).toBe(false);
    markDisconnected('host18');
    expect(hasActiveGracePeriod(room)).toBe(true);
    vi.useRealTimers();
    room.game = null;
  });
});
