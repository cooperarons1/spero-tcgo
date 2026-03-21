import { adminDb } from './firebaseAdmin.js';
import type { FriendRequest, FriendRecord, ChatMessage } from '../shared/types.js';

/** Generate a deterministic conversation ID for two users */
export function convoId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

/** Search users by displayName prefix, case-insensitive (max 10 results) */
export async function searchUsers(queryStr: string, excludeUid: string): Promise<{ uid: string; displayName: string }[]> {
  const lower = queryStr.toLowerCase();
  const snap = await adminDb.collection('users')
    .where('displayNameLower', '>=', lower)
    .where('displayNameLower', '<=', lower + '\uf8ff')
    .limit(10)
    .get();

  return snap.docs
    .filter(d => d.id !== excludeUid)
    .map(d => ({ uid: d.id, displayName: d.data().displayName as string }));
}

/** Send a friend request (returns request ID or null if duplicate/already friends) */
export async function sendFriendRequest(fromUid: string, fromName: string, toUid: string, toName: string): Promise<string | null> {
  // Check if already friends
  const friendDoc = await adminDb.collection('users').doc(fromUid).collection('friends').doc(toUid).get();
  if (friendDoc.exists) return null;

  // Check for existing pending request in either direction
  const existing = await adminDb.collection('friendRequests')
    .where('status', '==', 'pending')
    .where('fromUid', '==', fromUid)
    .where('toUid', '==', toUid)
    .limit(1)
    .get();
  if (!existing.empty) return null;

  // Check reverse direction too
  const reverse = await adminDb.collection('friendRequests')
    .where('status', '==', 'pending')
    .where('fromUid', '==', toUid)
    .where('toUid', '==', fromUid)
    .limit(1)
    .get();
  if (!reverse.empty) {
    // Auto-accept: they already sent us a request
    const reverseReq = reverse.docs[0];
    await acceptFriendRequest(reverseReq.id, fromUid);
    return reverseReq.id;
  }

  const ref = adminDb.collection('friendRequests').doc();
  await ref.set({
    fromUid,
    fromName,
    toUid,
    toName,
    status: 'pending',
    createdAt: Date.now(),
  });
  return ref.id;
}

/** Accept a friend request */
export async function acceptFriendRequest(requestId: string, acceptingUid: string): Promise<boolean> {
  const ref = adminDb.collection('friendRequests').doc(requestId);
  const doc = await ref.get();
  if (!doc.exists) return false;

  const data = doc.data() as Omit<FriendRequest, 'id'>;
  if (data.status !== 'pending') return false;
  if (data.toUid !== acceptingUid) return false;

  const now = Date.now();
  const batch = adminDb.batch();

  batch.update(ref, { status: 'accepted' });

  // Add friend records for both users
  batch.set(
    adminDb.collection('users').doc(data.fromUid).collection('friends').doc(data.toUid),
    { uid: data.toUid, displayName: data.toName, addedAt: now }
  );
  batch.set(
    adminDb.collection('users').doc(data.toUid).collection('friends').doc(data.fromUid),
    { uid: data.fromUid, displayName: data.fromName, addedAt: now }
  );

  await batch.commit();
  return true;
}

/** Reject a friend request */
export async function rejectFriendRequest(requestId: string, rejectingUid: string): Promise<boolean> {
  const ref = adminDb.collection('friendRequests').doc(requestId);
  const doc = await ref.get();
  if (!doc.exists) return false;

  const data = doc.data() as Omit<FriendRequest, 'id'>;
  if (data.status !== 'pending') return false;
  if (data.toUid !== rejectingUid) return false;

  await ref.update({ status: 'rejected' });
  return true;
}

/** Remove a friend (both directions) */
export async function removeFriend(uid: string, friendUid: string): Promise<boolean> {
  const batch = adminDb.batch();
  batch.delete(adminDb.collection('users').doc(uid).collection('friends').doc(friendUid));
  batch.delete(adminDb.collection('users').doc(friendUid).collection('friends').doc(uid));
  await batch.commit();
  return true;
}

/** Save a chat message */
export async function saveChatMessage(fromUid: string, toUid: string, text: string): Promise<ChatMessage> {
  const cid = convoId(fromUid, toUid);
  const ref = adminDb.collection('conversations').doc(cid).collection('messages').doc();
  const msg: Omit<ChatMessage, 'id'> = {
    fromUid,
    text,
    timestamp: Date.now(),
  };
  await ref.set(msg);
  return { id: ref.id, ...msg };
}

/** Get pending friend requests for a user */
export async function getPendingRequests(uid: string): Promise<FriendRequest[]> {
  const snap = await adminDb.collection('friendRequests')
    .where('toUid', '==', uid)
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
}

/** Get friends list for a user */
export async function getFriendsList(uid: string): Promise<FriendRecord[]> {
  const snap = await adminDb.collection('users').doc(uid).collection('friends')
    .orderBy('addedAt', 'desc')
    .get();

  return snap.docs.map(d => d.data() as FriendRecord);
}

/** Get chat history between two users */
export async function getChatHistory(uid1: string, uid2: string, limitCount = 50): Promise<ChatMessage[]> {
  const cid = convoId(uid1, uid2);
  const snap = await adminDb.collection('conversations').doc(cid).collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(limitCount)
    .get();

  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)).reverse();
}
