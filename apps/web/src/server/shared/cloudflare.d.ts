// The parts of the Workers runtime modules the server functions use. The plugin's generated types
// (`.cloudflare/types`) exist only after a dev server or a build has run.

declare module "cloudflare:workers" {
  /** The bindings in `cloudflare.config.ts`. A secret without a value is left out. */
  export const env: {
    TURNSTILE_SECRET_KEY?: string;
    INQUIRY_TO_ADDRESS?: string;
    INQUIRY_EMAIL?: { send(message: import("cloudflare:email").EmailMessage): Promise<unknown> };
    RAKUTEN_APPLICATION_ID?: string;
    RAKUTEN_ACCESS_KEY?: string;
    /** Not in a Preview (`cloudflare.config.ts`). */
    RAKUTEN_RATE_GATE?: DurableObjectNamespace<
      import("../item-lookup/rakuten-rate-gate.worker").RakutenRateGate
    >;
    /** The official event master (src/server/official-events/event-store.ts). */
    EVENTS_DB: D1Database;
    /** The sealed rows of the users who sync (src/server/sync/sync-records.ts). */
    SYNC_DB: D1Database;
  };

  export interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    all<T>(): Promise<{ results: T[] }>;
    first<T>(): Promise<T | null>;
    run(): Promise<{ meta: { changes: number } }>;
  }

  export interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch(statements: D1PreparedStatement[]): Promise<{ meta: { changes: number } }[]>;
  }

  /** What the runtime passes to the `scheduled` handler. */
  export interface ScheduledController {
    readonly cron: string;
    readonly scheduledTime: number;
  }

  export interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
  }

  export abstract class DurableObject {
    constructor(ctx: unknown, env: unknown);
  }

  type DurableObjectId = { readonly __durableObjectId: unique symbol };

  /** A stub calls the object's methods over RPC, so each returns a promise. */
  type DurableObjectStub<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R
      ? (...args: A) => Promise<Awaited<R>>
      : never;
  };

  interface DurableObjectNamespace<T> {
    idFromName(name: string): DurableObjectId;
    get(id: DurableObjectId): DurableObjectStub<T>;
  }
}

declare module "cloudflare:email" {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string | ReadableStream);
    readonly from: string;
    readonly to: string;
  }
}
