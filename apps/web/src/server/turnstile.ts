import ky, { SchemaValidationError, isHTTPError } from "ky";
import * as v from "valibot";

// Checks a Turnstile token with Cloudflare's `siteverify`.

export const SITEVERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const ResponseSchema = v.object({
  success: v.boolean(),
  "error-codes": v.optional(v.array(v.string()), []),
  /** The hostname of the page the widget was on. */
  hostname: v.optional(v.string()),
  /** The `action` the widget was rendered with. */
  action: v.optional(v.string()),
});

/**
 * Cloudflare's test secrets (always passes, always fails, token already spent), used in
 * development. They answer with `example.com` whatever the page, so neither the hostname nor the
 * action is checked with them.
 */
const TEST_SECRET = /^[123]x0{31}AA$/;

export type TurnstileFailure =
  /**
   * Turnstile answered that the token is not good: expired, used, or not from the widget. A token
   * from another host or another widget is rejected too, with `hostname-mismatch` or
   * `action-mismatch`.
   */
  | { reason: "rejected"; errorCodes: string[] }
  | { reason: "network" }
  | { reason: "http"; status: number }
  | { reason: "invalid-response" };

export type TurnstileResult = { ok: true } | { ok: false; error: TurnstileFailure };

type Options = {
  /** The user's IP address, which Turnstile compares with the one the token was given to. */
  remoteIp?: string | undefined;
  /** The hostname the token must have been given on. */
  hostname?: string | undefined;
  /** The `action` the widget must have been rendered with. */
  action?: string | undefined;
  fetch?: typeof fetch;
};

export async function verifyTurnstile(
  token: string,
  secret: string,
  { remoteIp, hostname, action, fetch }: Options = {},
): Promise<TurnstileResult> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const result = await ky
      .post(SITEVERIFY_ENDPOINT, { body, retry: 0, ...(fetch ? { fetch } : {}) })
      .json(ResponseSchema);
    if (!result.success) {
      return { ok: false, error: { reason: "rejected", errorCodes: result["error-codes"] } };
    }
    if (TEST_SECRET.test(secret)) return { ok: true };
    if (hostname !== undefined && result.hostname !== hostname) {
      return { ok: false, error: { reason: "rejected", errorCodes: ["hostname-mismatch"] } };
    }
    if (action !== undefined && result.action !== action) {
      return { ok: false, error: { reason: "rejected", errorCodes: ["action-mismatch"] } };
    }
    return { ok: true };
  } catch (error) {
    if (isHTTPError(error))
      return { ok: false, error: { reason: "http", status: error.response.status } };
    if (error instanceof SchemaValidationError || error instanceof SyntaxError) {
      return { ok: false, error: { reason: "invalid-response" } };
    }
    return { ok: false, error: { reason: "network" } };
  }
}
