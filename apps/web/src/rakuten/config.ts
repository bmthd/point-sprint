import * as v from "valibot";
import { siteUrl } from "../site-url.ts";

// The Rakuten API settings, read only by the server: the Worker's item lookup and the build's
// guide item lists.

/** The only site the app's settings let call the API: Rakuten checks the `Origin` header. */
export const ALLOWED_ORIGIN = siteUrl;

export const ITEM_SEARCH_ENDPOINT =
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";

// A value read without the dotenvx key stays `encrypted:…`.
const KeySchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty(),
  v.check((value) => !value.startsWith("encrypted:"), "still encrypted"),
);

/**
 * The application id, the access key and the affiliate id. The terms of use (第5条第2項) ask that
 * the application id be kept from others, so the id and the key are secrets the browser never
 * gets. The affiliate id is public: it is in every affiliate link.
 */
export const RakutenConfigSchema = v.object({
  applicationId: KeySchema,
  accessKey: KeySchema,
  affiliateId: v.optional(KeySchema),
});

export type RakutenConfig = v.InferOutput<typeof RakutenConfigSchema>;

/**
 * The settings in `RAKUTEN_APPLICATION_ID`, `RAKUTEN_ACCESS_KEY` and `RAKUTEN_AFFILIATE_ID`, or
 * `undefined` when they are missing or encrypted.
 */
export function readRakutenConfig(env: Record<string, string | undefined>) {
  const parsed = v.safeParse(RakutenConfigSchema, {
    applicationId: env.RAKUTEN_APPLICATION_ID,
    accessKey: env.RAKUTEN_ACCESS_KEY,
    ...(env.RAKUTEN_AFFILIATE_ID ? { affiliateId: env.RAKUTEN_AFFILIATE_ID } : {}),
  });
  return parsed.success ? parsed.output : undefined;
}
