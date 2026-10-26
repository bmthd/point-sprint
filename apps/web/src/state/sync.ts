import { CURRENT_SCHEMA_VERSION } from "@workspaces/domain";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { atomWithQuery, queryClientAtom } from "jotai-tanstack-query";
import { useEffect } from "react";
import { type SyncOutcome, createSyncRunner, syncOnce } from "../storage/sync-engine";
import type { SyncServer } from "../storage/sync-passkey";
import { useLatestRef } from "../use-latest-ref";
import { OutdatedDatabaseError } from "../storage/repository";
import { repositoryAtom } from "./repository";

export type SyncStatus =
  | { state: "off" }
  | { state: "syncing"; lastSyncedAt: Date | undefined }
  | { state: "synced"; lastSyncedAt: Date }
  /** Not connected: the changes wait on this device. */
  | { state: "offline"; lastSyncedAt: Date | undefined }
  | { state: "signed-out" }
  | { state: "failed"; lastSyncedAt: Date | undefined };

export const syncStatusAtom = atom<SyncStatus>({ state: "off" });

export const syncEnabledQueryKey = ["sync-enabled"] as const;

/** Whether this device syncs: it keeps the keys. */
export const syncEnabledQueryAtom = atomWithQuery((get) => {
  const repository = get(repositoryAtom);
  return {
    queryKey: syncEnabledQueryKey,
    queryFn: async () => (await repository.sync.meta.get()) !== undefined,
  };
});

const lastSyncedAt = (status: SyncStatus) =>
  "lastSyncedAt" in status ? status.lastSyncedAt : undefined;

/** Starts a round of sync, set by `useSync` once the app runs in the browser. */
export const requestSyncAtom = atom<{ request: () => Promise<void> }>({
  request: async () => {},
});

const WRITE_DELAY_MS = 2000;

/**
 * Syncs when the app opens, 2 seconds after a change is saved (changes made meanwhile go with it),
 * when the tab comes back to the front, and when the device is back online. Calls `onOutdated`
 * when a newer app wrote rows this one cannot read.
 */
export function useSync(server: SyncServer, onOutdated: () => void): void {
  const repository = useAtomValue(repositoryAtom);
  const client = useAtomValue(queryClientAtom);
  const setStatus = useSetAtom(syncStatusAtom);
  const setRequest = useSetAtom(requestSyncAtom);
  const onOutdatedRef = useLatestRef(onOutdated);

  useEffect(() => {
    let previous: SyncStatus = { state: "off" };
    const set = (status: SyncStatus) => {
      previous = status;
      setStatus(status);
    };
    const round = async (): Promise<SyncOutcome | "offline" | "failed"> => {
      try {
        if (!(await repository.sync.meta.get())) return { status: "off" };
        if (!navigator.onLine) return "offline";
        set({ state: "syncing", lastSyncedAt: lastSyncedAt(previous) });
        return await syncOnce({ repository, server, version: CURRENT_SCHEMA_VERSION });
      } catch (error) {
        if (error instanceof OutdatedDatabaseError) return { status: "outdated" };
        console.warn("[sync] round failed", error);
        return navigator.onLine ? "failed" : "offline";
      }
    };
    const runner = createSyncRunner(round, (outcome) => {
      const at = lastSyncedAt(previous);
      if (outcome === "offline") return set({ state: "offline", lastSyncedAt: at });
      if (outcome === "failed") return set({ state: "failed", lastSyncedAt: at });
      switch (outcome.status) {
        case "off":
          return set({ state: "off" });
        case "signed-out":
          return set({ state: "signed-out" });
        case "outdated":
          set({ state: "failed", lastSyncedAt: at });
          return onOutdatedRef.current();
        case "refused":
          return set({ state: "failed", lastSyncedAt: at });
        case "synced":
          set({ state: "synced", lastSyncedAt: new Date() });
          if (outcome.received) void client.invalidateQueries();
      }
    });
    setRequest({ request: runner.request });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const afterWrite = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void runner.request(), WRITE_DELAY_MS);
    };
    const unsubscribe = client.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") afterWrite();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void runner.request();
    };
    const onOnline = () => void runner.request();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    void runner.request();
    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [repository, server, client, setStatus, setRequest, onOutdatedRef]);
}
