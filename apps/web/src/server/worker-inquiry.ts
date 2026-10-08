import { getRequestHeader } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { EmailMessage } from "cloudflare:email";
import { type InquiryResult, handleInquiry } from "./inquiry";
import { INQUIRY_TURNSTILE_ACTION } from "./inquiry-input";
import { verifyTurnstile } from "./turnstile";

/** `handleInquiry` with the Worker's secrets, its `send_email` binding and the real siteverify. */
export function handleInquiryInWorker(request: unknown): Promise<InquiryResult> {
  const remoteIp = getRequestHeader("cf-connecting-ip");
  // The token must have been given on the host this request came to: production, a preview's
  // `workers.dev` address and localhost alike.
  const hostname = hostnameOf(getRequestHeader("host"));
  return handleInquiry(request, {
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    destination: env.INQUIRY_TO_ADDRESS,
    verifyToken: (token, secret) =>
      verifyTurnstile(token, secret, { remoteIp, hostname, action: INQUIRY_TURNSTILE_ACTION }),
    send: async ({ from, to, raw }) => {
      if (!env.INQUIRY_EMAIL) throw new Error("the INQUIRY_EMAIL binding is missing");
      await env.INQUIRY_EMAIL.send(new EmailMessage(from, to, raw));
    },
  });
}

/** The `Host` header without its port, or `""` (which no token has) when there is none. */
function hostnameOf(host: string | undefined): string {
  if (!host) return "";
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return "";
  }
}
