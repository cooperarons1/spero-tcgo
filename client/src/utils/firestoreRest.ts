// Firestore REST adapter — used on iOS where the JS Firebase SDK's
// signin hangs in WKWebView (IndexedDB persistence + WebSocket transport
// both misbehave). The @capacitor-firebase/authentication plugin signs
// the user into the native iOS Firebase SDK, which can mint ID tokens via
// `getIdToken()` — we use those tokens here as Bearer credentials against
// the Firestore REST API directly.
//
// This is a tiny subset of Firestore's API: get/set/delete documents,
// list a subcollection. Enough for deckStorage and quest reads. If we
// ever need transactions or batched writes from iOS, expand it.

const PROJECT_ID = 'spero-tcgo';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getToken(): Promise<string> {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const { token } = await FirebaseAuthentication.getIdToken({ forceRefresh: false });
  if (!token) throw new Error('No iOS Firebase ID token — user not signed in via native plugin');
  return token;
}

// JSON value <-> Firestore typed-value converter. Firestore REST encodes
// every field as `{ stringValue, integerValue, booleanValue, arrayValue,
// mapValue, ... }` — we map back and forth here so callers can pass plain
// JS objects.

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

function toFs(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFs) } };
  }
  if (typeof v === 'object') {
    const fields: Record<string, FsValue> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) fields[k] = toFs(val);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function fromFs(v: FsValue | undefined): unknown {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromFs);
  if ('mapValue' in v) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v.mapValue.fields ?? {})) out[k] = fromFs(val);
    return out;
  }
  return undefined;
}

function toFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = toFs(v);
  return out;
}

function fromFields(fields: Record<string, FsValue> | undefined): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = fromFs(v);
  return out;
}

export interface RestDoc {
  id: string;
  data: Record<string, unknown>;
}

export async function restGetDoc(path: string): Promise<RestDoc | null> {
  const token = await getToken();
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore GET ${path} failed: ${r.status}`);
  const j: { name: string; fields?: Record<string, FsValue> } = await r.json();
  const id = j.name.split('/').pop()!;
  return { id, data: fromFields(j.fields) };
}

export async function restListCollection(path: string): Promise<RestDoc[]> {
  const token = await getToken();
  const all: RestDoc[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${BASE}/${path}`);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      if (r.status === 404) return all;
      throw new Error(`Firestore LIST ${path} failed: ${r.status}`);
    }
    const j: { documents?: { name: string; fields?: Record<string, FsValue> }[]; nextPageToken?: string } = await r.json();
    for (const d of j.documents ?? []) {
      const id = d.name.split('/').pop()!;
      all.push({ id, data: fromFields(d.fields) });
    }
    pageToken = j.nextPageToken;
  } while (pageToken);
  return all;
}

export async function restSetDoc(path: string, data: Record<string, unknown>, merge = false): Promise<void> {
  const token = await getToken();
  const url = new URL(`${BASE}/${path}`);
  if (merge) {
    for (const k of Object.keys(data)) url.searchParams.append('updateMask.fieldPaths', k);
  }
  const r = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!r.ok) throw new Error(`Firestore SET ${path} failed: ${r.status} ${await r.text()}`);
}

export async function restDeleteDoc(path: string): Promise<void> {
  const token = await getToken();
  const r = await fetch(`${BASE}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok && r.status !== 404) throw new Error(`Firestore DELETE ${path} failed: ${r.status}`);
}
