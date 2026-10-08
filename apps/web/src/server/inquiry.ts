import * as v from "valibot";
import { InquiryRequestSchema } from "./inquiry-input";
import { INQUIRY_FROM, buildInquiryMail } from "./inquiry-mail";
import type { TurnstileResult } from "./turnstile";

// The inquiry's steps on the server, with the Worker's bindings passed in so tests can stand in.

/** Where an inquiry stopped. The user is told only that it was not sent. */
export type InquiryStage = "input" | "config" | "turnstile" | "send";

export type InquiryResult = { ok: true } | { ok: false; stage: InquiryStage };

export type InquiryDeps = {
  /** `TURNSTILE_SECRET_KEY`. */
  turnstileSecret: string | undefined;
  /** `INQUIRY_TO_ADDRESS`: the operator's address, verified in Email Routing. */
  destination: string | undefined;
  verifyToken: (token: string, secret: string) => Promise<TurnstileResult>;
  /** The `send_email` binding's `send`, given the raw MIME message. */
  send: (message: { from: string; to: string; raw: string }) => Promise<void>;
  now?: () => Date;
  messageId?: () => string;
  /** Takes only the stage and codes, never what the user wrote. */
  log?: (message: string) => void;
};

const filled = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== "";

/** Checks the input, then the Turnstile token, then sends the mail to the operator. */
export async function handleInquiry(
  request: unknown,
  {
    turnstileSecret,
    destination,
    verifyToken,
    send,
    now = () => new Date(),
    messageId = () => `${crypto.randomUUID()}@bmth.dev`,
    log = console.error,
  }: InquiryDeps,
): Promise<InquiryResult> {
  const fail = (stage: InquiryStage, detail?: string): InquiryResult => {
    log(`inquiry failed at ${stage}${detail ? `: ${detail}` : ""}`);
    return { ok: false, stage };
  };

  const parsed = v.safeParse(InquiryRequestSchema, request);
  if (!parsed.success) {
    const paths = parsed.issues.map((issue) => v.getDotPath(issue) ?? "(root)");
    return fail("input", [...new Set(paths)].join(", "));
  }
  if (!filled(turnstileSecret)) return fail("config", "TURNSTILE_SECRET_KEY is not set");
  if (!filled(destination)) return fail("config", "INQUIRY_TO_ADDRESS is not set");

  const { turnstileToken, ...inquiry } = parsed.output;
  const verified = await verifyToken(turnstileToken, turnstileSecret);
  if (!verified.ok) {
    const { error } = verified;
    const detail =
      error.reason === "rejected"
        ? `rejected (${error.errorCodes.join(", ")})`
        : error.reason === "http"
          ? `http ${error.status}`
          : error.reason;
    return fail("turnstile", detail);
  }

  const raw = buildInquiryMail({ inquiry, to: destination, sentAt: now(), messageId: messageId() });
  try {
    await send({ from: INQUIRY_FROM, to: destination, raw });
  } catch (error) {
    // The binding's errors tell what was wrong with the mail, not what it said.
    return fail("send", error instanceof Error ? error.message : "unknown error");
  }
  return { ok: true };
}
