import { createServerFn } from "@tanstack/react-start";
import { LookupItemInputSchema } from "../rakuten/item-lookup";

/**
 * The item on an item page, looked up by the Worker, which alone holds the Rakuten API's keys.
 * `maxWaitMs` is how long the lookup may wait for its turn at the API.
 */
export const lookupItem = createServerFn({ method: "POST" })
  .validator(LookupItemInputSchema)
  .handler(async ({ data }) => {
    // Loaded here: it imports the Workers runtime, which tests that import this module lack.
    const { lookupItemInWorker } = await import("./worker-item-lookup");
    return lookupItemInWorker(data);
  });
