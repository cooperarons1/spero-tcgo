import { describe, it, expect } from 'vitest';
import { convoId } from '../friends.js';

describe('convoId', () => {
  it('sorts alphabetically', () => {
    expect(convoId('alice', 'bob')).toBe('alice_bob');
  });

  it('same result regardless of argument order', () => {
    expect(convoId('bob', 'alice')).toBe('alice_bob');
    expect(convoId('alice', 'bob')).toBe(convoId('bob', 'alice'));
  });

  it('handles same uid twice', () => {
    expect(convoId('alice', 'alice')).toBe('alice_alice');
  });

  it('handles numeric-looking uids', () => {
    expect(convoId('123', '456')).toBe('123_456');
    expect(convoId('456', '123')).toBe('123_456');
  });

  it('handles uids with special characters', () => {
    const id1 = 'abc-def';
    const id2 = 'xyz-123';
    const result = convoId(id1, id2);
    expect(result).toContain('_');
    expect(result).toBe(convoId(id2, id1));
  });
});
