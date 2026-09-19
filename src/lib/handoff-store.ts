// Phone → desktop photo handoff. A tiny in-memory queue per token: the phone
// POSTs compressed photos, the desktop polls and consumes them.
// v1/demo only — production would put these in the S3-compatible bucket with
// signed, expiring upload URLs tied to the candidate's session.
import type { Photo } from "@/engine/responses";

type Store = Map<string, { photos: Photo[]; touched: number }>;
const g = globalThis as unknown as { __ruHandoff?: Store };
const store: Store = (g.__ruHandoff ??= new Map());
const TTL_MS = 2 * 60 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [k, v] of store) if (now - v.touched > TTL_MS) store.delete(k);
}

export function putPhoto(token: string, photo: Photo) {
  sweep();
  const entry = store.get(token) ?? { photos: [], touched: 0 };
  entry.photos = [...entry.photos.filter((p) => p.id !== photo.id), photo].slice(-6);
  entry.touched = Date.now();
  store.set(token, entry);
}

export function listPhotos(token: string): Photo[] {
  return store.get(token)?.photos ?? [];
}

export function takePhotos(token: string, ids: string[]) {
  const entry = store.get(token);
  if (entry) entry.photos = entry.photos.filter((p) => !ids.includes(p.id));
}
