import type { Plan, Profile, Shop } from "@workspaces/domain";

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
  /** True when the database could not be opened at its current version and was recreated empty. */
  wasReset(): boolean;
}
