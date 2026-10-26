import { atom } from "jotai";
import type { SyncServer } from "../storage/sync-passkey";

/** The sync server functions; tests replace them in their Jotai store. */
export const syncServerAtom = atom<SyncServer>({
  reissueRecovery: async (data) =>
    (await import("../server/sync-functions")).syncReissueRecovery({ data }),
  startOptions: async (data) =>
    (await import("../server/sync-functions")).syncStartOptions({ data }),
  addPasskeyOptions: async () => (await import("../server/sync-functions")).syncAddPasskeyOptions(),
  register: async (data) => (await import("../server/sync-functions")).syncRegister({ data }),
  loginOptions: async () => (await import("../server/sync-functions")).syncLoginOptions(),
  login: async (data) => (await import("../server/sync-functions")).syncLogin({ data }),
  recoveryLogin: async (data) =>
    (await import("../server/sync-functions")).syncRecoveryLogin({ data }),
  setPrfWrap: async (data) => (await import("../server/sync-functions")).syncSetPrfWrap({ data }),
  stop: async () => (await import("../server/sync-functions")).syncStop(),
  push: async (data) => (await import("../server/sync-functions")).syncPush({ data }),
  pull: async (data) => (await import("../server/sync-functions")).syncPull({ data }),
});
