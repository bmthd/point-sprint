import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { ITEM_SEARCH_ENDPOINT } from "../rakuten/config";
import type { ItemLookupResult, LookupItemInput } from "../rakuten/item-lookup";
import { handleItemLookup } from "./item-lookup";
import { workerRakutenConfig } from "./worker-rakuten-config";

/** `handleItemLookup` with the Worker's secrets and the one rate gate every lookup shares. */
export function lookupItemInWorker(input: LookupItemInput): Promise<ItemLookupResult> {
  const gates = env.RAKUTEN_RATE_GATE;
  // A Preview has no rate gate, so no lookup either.
  if (!gates) return Promise.resolve({ ok: false, error: { reason: "unavailable" } });
  const gate = gates.get(gates.idFromName("rakuten-api"));
  return handleItemLookup(input, {
    config: workerRakutenConfig(),
    takeTurn: (maxWaitMs) => gate.take(maxWaitMs),
    endpoint: import.meta.env.ITEM_LOOKUP_ENDPOINT ?? ITEM_SEARCH_ENDPOINT,
    // Aborted when the browser gives up (「やめる」), where the runtime reports it.
    signal: getRequest().signal,
  });
}
