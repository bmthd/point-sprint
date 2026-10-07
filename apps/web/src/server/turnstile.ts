import ky, { SchemaValidationError, isHTTPError } from "ky";
import * as v from "valibot";

// Checks a Turnstile token with Cloudflare's `siteverify`.

export const SITEVERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const ResponseSchema = v.object({
  success: v.boolean(),
  "error-codes": v.optional(v.array(v.string()), []),
});

export type TurnstileFailure =
  /** Turnstile answered that the token is not good: expired, used, or not from the widget. */
  | { reason: "rejected"; errorCodes: string[] }
  | { reason: "network" }
  | { reason: "http"; status: number }
  | { reason: "invalid-response" };

export type TurnstileResult = { ok: true } | { ok: false; error: TurnstileFailure };

type Options = {
  /** The user's IP address, which Turnstile compares with the one the token was given to. */
  remoteIp?: string | undefined;
  fetch?: typeof fetch;
};

export async function verifyTurnstile(
  token: string,
  secret: string,
  { remoteIp, fetch }: Options = {},
): Promise<TurnstileResult> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const result = await ky
      .post(SITEVERIFY_ENDPOINT, { body, retry: 0, ...(fetch ? { fetch } : {}) })
      .json(ResponseSchema);
    return result.success
      ? { ok: true }
      : { ok: false, error: { reason: "rejected", errorCodes: result["error-codes"] } };
  } catch (error) {
    if (isHTTPError(error))
      return { ok: false, error: { reason: "http", status: error.response.status } };
    if (error instanceof SchemaValidationError || error instanceof SyntaxError) {
      return { ok: false, error: { reason: "invalid-response" } };
    }
    return { ok: false, error: { reason: "network" } };
  }
}
