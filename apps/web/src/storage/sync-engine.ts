import { type SyncRow, migrateRow, syncStores } from "@workspaces/domain";
import { LIMITS } from "../server/sync/sync-records";
import type { Repository } from "./repository";
import { decryptRecord, encryptRow } from "./sync-crypto";
import type { SyncServer } from "./sync-passkey";

// One round of sync: read what the other devices wrote since the last round, keep the rows newer
// than this device's, then send what this device wrote since.

export type SyncOutcome =
  | { status: "off" }
  | { status: "synced"; received: boolean }
  /** A newer app wrote rows this one cannot read: it must reload. */
  | { status: "outdated" }
  /** The session ended: log in again to sync. */
  | { status: "signed-out" }
  /** The server refused the rows sent: too many, too large, or too far ahead. */
  | { status: "refused"; reason: string };

export type SyncDeps = {
  repository: Repository;
  server: Pick<SyncServer, "pull" | "push">;
  /** The data version this app reads and writes (`CURRENT_SCHEMA_VERSION`). */
  version: number;
};

/** A received row as this app stores it: older versions go through the migrations. */
function migrated(row: SyncRow, from: number): SyncRow {
  if (row.deleted) return row;
  return { ...row, value: migrateRow(syncStores[row.kind], row.value, from) };
}

export async function syncOnce({ repository, server, version }: SyncDeps): Promise<SyncOutcome> {
  const meta = await repository.sync.meta.get();
  if (!meta) return { status: "off" };
  const keys = { encryptionKey: meta.encryptionKey, idKey: meta.idKey };

  let cursor = meta.cursor;
  let received = false;
  for (;;) {
    const pulled = await server.pull({ since: cursor });
    if (!pulled.ok) return { status: "signed-out" };
    const rows: SyncRow[] = [];
    for (const record of pulled.records) {
      let opened: Awaited<ReturnType<typeof decryptRecord>>;
      try {
        opened = await decryptRecord(keys, record);
      } catch (error) {
        // Sealed with other keys or changed on the way: nothing this device can keep.
        console.warn("[sync] could not open a record", error);
        continue;
      }
      if (opened.version > version) return { status: "outdated" };
      rows.push(opened.version < version ? migrated(opened.row, opened.version) : opened.row);
    }
    if (await repository.sync.apply(rows, meta.accountId)) received = true;
    cursor = pulled.seq;
    // Stopped meanwhile: keep nothing.
    const current = await repository.sync.meta.get();
    if (current?.accountId !== meta.accountId) return { status: "off" };
    await repository.sync.meta.put({ ...current, cursor });
    if (!pulled.more) break;
  }

  const pending = await repository.sync.pending();
  for (let start = 0; start < pending.length; start += LIMITS.push) {
    const rows = pending.slice(start, start + LIMITS.push);
    const records = await Promise.all(rows.map((row) => encryptRow(keys, row, version)));
    const pushed = await server.push({ records });
    if (!pushed.ok) {
      if (pushed.reason === "signed-out") return { status: "signed-out" };
      if (pushed.reason === "outdated") return { status: "outdated" };
      return { status: "refused", reason: pushed.reason };
    }
    await repository.sync.acknowledge(rows);
  }
  return { status: "synced", received };
}

/**
 * Runs `round` one at a time. A request made while a round runs starts one more round after it,
 * so that a change written meanwhile is sent too.
 */
export function createSyncRunner<T>(round: () => Promise<T>, onDone: (outcome: T) => void) {
  let running: Promise<void> | undefined;
  let again = false;
  const run = async (): Promise<void> => {
    do {
      again = false;
      onDone(await round());
    } while (again);
  };
  return {
    request(): Promise<void> {
      if (running) {
        again = true;
        return running;
      }
      running = run().finally(() => {
        running = undefined;
      });
      return running;
    },
  };
}
