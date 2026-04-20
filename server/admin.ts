// Admin UID whitelist. Admins bypass the economy — get all cards,
// 999k gold/dust — so owners/testers can exercise the full card pool
// without buying packs. Kept as an env var with a hard-coded fallback
// for the owner UID so production always recognizes them even if the
// env isn't set on a fresh Cloud Run revision.
//
// Add or remove admins by setting SPERO_ADMIN_UIDS (comma-separated)
// on the Cloud Run service.

const DEFAULT_ADMIN_UIDS = new Set<string>([
  '0ysCugvnCJXHcYgcCD0JXA0Em6h1', // cooper.arons@gmail.com — owner
]);

const ENV_ADMIN_UIDS = new Set<string>(
  (process.env.SPERO_ADMIN_UIDS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

export function isAdminUid(uid: string): boolean {
  return DEFAULT_ADMIN_UIDS.has(uid) || ENV_ADMIN_UIDS.has(uid);
}
