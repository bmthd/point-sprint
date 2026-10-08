import * as v from "valibot";

// The Rakuten API settings, shared by the browser (item lookup) and the build (the guides' item lists).

/** The only site the app's settings let call the API: Rakuten checks the `Origin` header. */
export const ALLOWED_ORIGIN = "https://point-sprint.bmth.dev";

export const ITEM_SEARCH_ENDPOINT =
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";

/** Where the dev server relays calls to the API, putting `ALLOWED_ORIGIN` in place of localhost. */
export const DEV_PROXY_PATH = "/rakuten-api";

// The values are kept in plain text; one encrypted by mistake stays `encrypted:…` without the key.
const KeySchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty(),
  v.check((value) => !value.startsWith("encrypted:"), "still encrypted"),
);

/**
 * The application id, the access key and the affiliate id. None of them is a secret: the access
 * key works from anywhere that sends the allowed `Origin`, so it is shipped to the browser.
 */
export const RakutenConfigSchema = v.object({
  applicationId: KeySchema,
  accessKey: KeySchema,
  affiliateId: v.optional(KeySchema),
});

export type RakutenConfig = v.InferOutput<typeof RakutenConfigSchema>;

/**
 * The settings in `PUBLIC_RAKUTEN_APPLICATION_ID`, `PUBLIC_RAKUTEN_ACCESS_KEY` and
 * `PUBLIC_RAKUTEN_AFFILIATE_ID`, or `undefined` when they are missing or encrypted.
 */
export function readRakutenConfig(env: Record<string, string | undefined>) {
  const parsed = v.safeParse(RakutenConfigSchema, {
    applicationId: env.PUBLIC_RAKUTEN_APPLICATION_ID,
    accessKey: env.PUBLIC_RAKUTEN_ACCESS_KEY,
    ...(env.PUBLIC_RAKUTEN_AFFILIATE_ID ? { affiliateId: env.PUBLIC_RAKUTEN_AFFILIATE_ID } : {}),
  });
  return parsed.success ? parsed.output : undefined;
}
