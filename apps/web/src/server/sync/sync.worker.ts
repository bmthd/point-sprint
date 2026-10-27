import {
  deleteCookie,
  getCookie,
  getRequest,
  getRequestHeader,
  setCookie,
} from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { devMigrated } from "../shared/dev-migrations.worker";
import { type SyncAuthDeps, sessionAccount } from "./sync-auth";
import { verifyTurnstile } from "../shared/turnstile";

// The Worker's side of the sync's server functions: the database, the site's origin, the session's
// cookie and Turnstile.

/** A request from another site, which the server functions refuse. */
export class ForeignOriginError extends Error {
  constructor() {
    super("The request did not come from the site.");
    this.name = "ForeignOriginError";
  }
}

/**
 * The sync's database and the origin the passkeys belong to: the request's own, so that a Preview
 * on workers.dev has passkeys of its own. A request whose `Origin` is another site's is refused.
 */
export async function syncDeps(): Promise<SyncAuthDeps> {
  const url = new URL(getRequest().url);
  if (getRequestHeader("origin") !== url.origin) throw new ForeignOriginError();
  return {
    db: await devMigrated(env.SYNC_DB, "sync"),
    rpID: url.hostname,
    origin: url.origin,
  };
}

// `__Host-` keeps the cookie to this host over HTTPS; the dev server runs over HTTP.
const cookieName = () => (new URL(getRequest().url).protocol === "https:" ? "__Host-sync" : "sync");

export function setSessionCookie(token: string): void {
  const secure = new URL(getRequest().url).protocol === "https:";
  setCookie(cookieName(), token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 400 * 24 * 60 * 60,
  });
}

export function clearSessionCookie(): void {
  deleteCookie(cookieName(), { path: "/" });
}

export function sessionToken(): string | undefined {
  return getCookie(cookieName());
}

/** The account the request is logged in to. */
export async function sessionOf(deps: SyncAuthDeps): Promise<string | undefined> {
  return sessionAccount(deps, sessionToken());
}

/** Whether Turnstile lets the request through. Without the secret, nothing is let through. */
export async function turnstileVerifier(token: string) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, error: { reason: "http", status: 0 } } as const;
  return verifyTurnstile(token, secret, { remoteIp: getRequestHeader("cf-connecting-ip") });
}
