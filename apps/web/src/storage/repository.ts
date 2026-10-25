import type {
  Plan,
  Profile,
  Shop,
  SpuMonth,
  StoreName,
  SyncKind,
  SyncRow,
} from "@workspaces/domain";

/** A stored row that failed validation on read, as it was stored, with why it failed. */
export type QuarantinedRow = {
  key: number;
  store: StoreName;
  value: unknown;
  issues: { message: string; path: string[] }[];
};

/** What this device keeps to sync: the account, how far it has read, and the keys. */
export type SyncMeta = {
  accountId: string;
  /** The server's sequence number of the last row read. */
  cursor: number;
  /** Encrypts the rows; cannot be read out of this device (`extractable: false`). */
  encryptionKey: CryptoKey;
  /** Makes the rows' ids on the server; cannot be read out either. */
  idKey: CryptoKey;
};

/**
 * The rows to send and the rows received. Every write marks its rows to send (the outbox), in the
 * same transaction, whether or not this device syncs: starting to sync sends everything anyway.
 */
export interface SyncRepository {
  /** The rows marked to send, as they are now; a removed row as its mark. */
  pending(): Promise<SyncRow[]>;
  /** Clears the mark of each row sent, unless the row changed since (another `updatedAt`). */
  acknowledge(rows: readonly { kind: SyncKind; id: string; updatedAt: string }[]): Promise<void>;
  /**
   * Writes the rows received that are newer than the ones here, without marking them to send.
   * A row that fails validation is set aside. Resolves to whether anything was written.
   */
  apply(rows: readonly SyncRow[]): Promise<boolean>;
  /** Marks every row and every removal to send. */
  markAllPending(): Promise<void>;
  meta: { get(): Promise<SyncMeta | undefined>; put(meta: SyncMeta | undefined): Promise<void> };
}

/** Reads and writes only the records asked for; never loads the whole database. */
export interface Repository {
  plans: {
    list(): Promise<Plan[]>;
    get(id: string): Promise<Plan | undefined>;
    put(plan: Plan): Promise<void>;
    delete(id: string): Promise<void>;
  };
  shops: { list(): Promise<Shop[]>; put(shop: Shop): Promise<void> };
  profile: { get(): Promise<Profile | undefined>; put(profile: Profile): Promise<void> };
  /** The SPU of each account and month that the user has set. */
  spuMonths: { list(): Promise<SpuMonth[]>; put(month: SpuMonth): Promise<void> };
  /** Number of stored rows that failed validation on read and were moved aside. */
  quarantined(): Promise<number>;
  /** The rows set aside, oldest first, and a way to remove them for good. */
  quarantine: {
    list(): Promise<QuarantinedRow[]>;
    delete(key: number): Promise<void>;
    clear(): Promise<void>;
  };
  sync: SyncRepository;
  /**
   * Removes every stored row, the quarantined ones and what this device keeps to sync included, in
   * one transaction. A device that synced stops syncing; the rows on the server stay.
   */
  clear(): Promise<void>;
  /** True when the database could not be opened at its current version and was recreated empty. */
  wasReset(): boolean;
}

/** The database was upgraded by a newer version of the app; this one must reload to use it. */
export class OutdatedDatabaseError extends Error {
  constructor() {
    super("The database belongs to a newer version of the app.");
    this.name = "OutdatedDatabaseError";
  }
}
