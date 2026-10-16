import type { Plan, Profile, Shop, StoreName } from "@workspaces/domain";

/** A stored row that failed validation on read, as it was stored, with why it failed. */
export type QuarantinedRow = {
  key: number;
  store: StoreName;
  value: unknown;
  issues: { message: string; path: string[] }[];
};

/** Reads and writes only the records asked for; never loads or syncs the whole database. */
export interface Repository {
  plans: {
    list(): Promise<Plan[]>;
    get(id: string): Promise<Plan | undefined>;
    put(plan: Plan): Promise<void>;
    delete(id: string): Promise<void>;
  };
  shops: { list(): Promise<Shop[]>; put(shop: Shop): Promise<void> };
  profile: { get(): Promise<Profile | undefined>; put(profile: Profile): Promise<void> };
  /** Number of stored rows that failed validation on read and were moved aside. */
  quarantined(): Promise<number>;
  /** The rows set aside, oldest first, and a way to remove them for good. */
  quarantine: {
    list(): Promise<QuarantinedRow[]>;
    delete(key: number): Promise<void>;
    clear(): Promise<void>;
  };
  /** Removes every stored row, the quarantined ones included, in one transaction. */
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
