import {
  syncAddPasskeyOptions,
  syncReissueRecovery,
  syncLogin,
  syncLoginOptions,
  syncPull,
  syncPush,
  syncRecoveryLogin,
  syncRegister,
  syncSetPrfWrap,
  syncStartOptions,
  syncStop,
} from "../server/sync-functions";
import type { SyncServer } from "../storage/sync-passkey";

/**
 * The sync's server functions, as the flows call them. Imported by the routes only and passed
 * down, like the inquiry's, so that the components' tests do without the server.
 */
export const syncServer: SyncServer = {
  reissueRecovery: (data) => syncReissueRecovery({ data }),
  startOptions: (data) => syncStartOptions({ data }),
  addPasskeyOptions: () => syncAddPasskeyOptions(),
  register: (data) => syncRegister({ data }),
  loginOptions: () => syncLoginOptions(),
  login: (data) => syncLogin({ data }),
  recoveryLogin: (data) => syncRecoveryLogin({ data }),
  setPrfWrap: (data) => syncSetPrfWrap({ data }),
  stop: () => syncStop(),
  push: (data) => syncPush({ data }),
  pull: (data) => syncPull({ data }),
};
