import { atom } from "jotai";
import type { SyncServer } from "../storage/sync-passkey";

// Load on demand so browser tests can replace the atom without loading the server runtime.
const functions = () => import("../server/sync/sync.functions");

/** The sync server functions; tests replace them in their Jotai store. */
export const syncServerAtom = atom<SyncServer>({
  reissueRecovery: async (data) => (await functions()).syncReissueRecovery({ data }),
  startOptions: async (data) => (await functions()).syncStartOptions({ data }),
  addPasskeyOptions: async () => (await functions()).syncAddPasskeyOptions(),
  register: async (data) => (await functions()).syncRegister({ data }),
  loginOptions: async () => (await functions()).syncLoginOptions(),
  login: async (data) => (await functions()).syncLogin({ data }),
  recoveryLogin: async (data) => (await functions()).syncRecoveryLogin({ data }),
  setPrfWrap: async (data) => (await functions()).syncSetPrfWrap({ data }),
  stop: async () => (await functions()).syncStop(),
  push: async (data) => (await functions()).syncPush({ data }),
  pull: async (data) => (await functions()).syncPull({ data }),
});
