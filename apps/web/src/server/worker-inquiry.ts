import { getRequestHeader } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { EmailMessage } from "cloudflare:email";
import { type InquiryResult, handleInquiry } from "./inquiry";
import { verifyTurnstile } from "./turnstile";

/** `handleInquiry` with the Worker's secrets, its `send_email` binding and the real siteverify. */
export function handleInquiryInWorker(request: unknown): Promise<InquiryResult> {
  const remoteIp = getRequestHeader("cf-connecting-ip");
  return handleInquiry(request, {
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    destination: env.INQUIRY_TO_ADDRESS,
    verifyToken: (token, secret) => verifyTurnstile(token, secret, { remoteIp }),
    send: async ({ from, to, raw }) => {
      if (!env.INQUIRY_EMAIL) throw new Error("the INQUIRY_EMAIL binding is missing");
      await env.INQUIRY_EMAIL.send(new EmailMessage(from, to, raw));
    },
  });
}
