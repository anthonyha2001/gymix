// The offline outbox: things done without a connection, kept on the phone
// (IndexedDB) in order and sent to /api/sync once the connection is back.
// Client-only. Survives closing the app. Cleared on log out.

export type OutboxOp =
  | { kind: "set"; sessionId: string; exerciseId: string; setNumber: number; weightKg: number; reps: number }
  | { kind: "remove_set"; sessionId: string; exerciseId: string; setNumber: number }
  | { kind: "finish"; sessionId: string; notes: string | null; finishedAt: string };

export type QueuedOp = OutboxOp & { id: string; queuedAt: number };

const DB = "gymix-offline";
const STORE = "outbox";
export const OUTBOX_EVENT = "gymix:outbox";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req ? (req.result as T) : undefined);
    };
    t.onerror = () => reject(t.error);
  });
}

const changed = () => window.dispatchEvent(new Event(OUTBOX_EVENT));

// A set logged again (or removed) replaces what was queued for that same set,
// so the queue never sends stale values.
const sameSet = (a: OutboxOp, b: OutboxOp) =>
  a.kind !== "finish" && b.kind !== "finish" && a.sessionId === b.sessionId && a.exerciseId === b.exerciseId && a.setNumber === b.setNumber;

export async function queue(op: OutboxOp) {
  const existing = await list();
  await tx("readwrite", (store) => {
    for (const old of existing) if (sameSet(old, op)) store.delete(old.id);
    store.put({ ...op, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, queuedAt: Date.now() });
  });
  changed();
}

export async function list(): Promise<QueuedOp[]> {
  try {
    const all = (await tx<QueuedOp[]>("readonly", (store) => store.getAll())) ?? [];
    return all.sort((a, b) => a.queuedAt - b.queuedAt);
  } catch {
    return [];
  }
}

export async function remove(ids: string[]) {
  if (!ids.length) return;
  await tx("readwrite", (store) => {
    for (const id of ids) store.delete(id);
  });
  changed();
}

export async function clear() {
  try {
    await tx("readwrite", (store) => store.clear());
    changed();
  } catch {
    // Nothing stored.
  }
}

// Queued sets for one workout, to show them on the workout screen (also when
// the page itself came from the offline copy and doesn't know about them).
export async function pendingFor(sessionId: string) {
  return (await list()).filter((op) => op.sessionId === sessionId);
}

// Did a server action fail because there's no connection (rather than a real error)?
export function isOfflineError(e: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return e instanceof TypeError || (e instanceof Error && /fetch|network|load failed/i.test(e.message));
}

let flushing: Promise<SyncSummary> | null = null;
export type SyncSummary = { sent: number; failed: number; left: number; prs: string[] };

// Sends the queue, oldest first. Ops the server rejects for good are dropped
// (and counted as failed); anything else stays for the next try.
export function flush(): Promise<SyncSummary> {
  return (flushing ??= (async () => {
    try {
      const ops = await list();
      if (!ops.length) return { sent: 0, failed: 0, left: 0, prs: [] };
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops }),
        cache: "no-store",
      });
      if (!res.ok) return { sent: 0, failed: 0, left: ops.length, prs: [] };
      const { results } = (await res.json()) as { results: { id: string; ok: boolean; permanent?: boolean; pr?: string }[] };
      const done = results.filter((r) => r.ok || r.permanent);
      await remove(done.map((r) => r.id));
      return {
        sent: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok && r.permanent).length,
        left: ops.length - done.length,
        prs: results.flatMap((r) => (r.pr ? [r.pr] : [])),
      };
    } catch {
      return { sent: 0, failed: 0, left: (await list()).length, prs: [] };
    } finally {
      flushing = null;
    }
  })());
}
