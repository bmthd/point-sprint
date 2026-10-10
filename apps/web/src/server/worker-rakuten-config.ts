import { env } from "cloudflare:workers";
import { readRakutenConfig } from "../rakuten/config";

/** The Rakuten settings: the keys are the Worker's secrets, the affiliate id is in the build. */
export const workerRakutenConfig = () =>
  readRakutenConfig({
    RAKUTEN_APPLICATION_ID: env.RAKUTEN_APPLICATION_ID,
    RAKUTEN_ACCESS_KEY: env.RAKUTEN_ACCESS_KEY,
    RAKUTEN_AFFILIATE_ID: import.meta.env.RAKUTEN_AFFILIATE_ID ?? undefined,
  });
