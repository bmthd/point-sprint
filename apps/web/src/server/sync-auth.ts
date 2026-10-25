import {
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { D1Database } from "cloudflare:workers";
import type { TurnstileResult } from "./turnstile";

// Logging in to sync with a passkey, or with the recovery code, and the sessions that follow. The
// server never learns who the user is: an account is a random id, and the passkey's name is the
// site's.

export type SyncAuthDeps = {
  db: D1Database;
  /** The site's host name, which the passkeys are made for. */
  rpID: string;
  /** The site's origin, which the browser signed the passkey's response for. */
  origin: string;
  now?: () => Date;
  /** Tests only: stand-ins for the WebAuthn checks. */
  verifyRegistration?: typeof verifyRegistrationResponse;
  verifyAuthentication?: typeof verifyAuthenticationResponse;
};

const CHALLENGE_MS = 5 * 60 * 1000;
const SESSION_MS = 400 * 24 * 60 * 60 * 1000;
const SITE_NAME = "ポイントスプリント";

const encoder = new TextEncoder();

export const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (char) =>
    char.charCodeAt(0),
  );

const sha256 = async (text: string) =>
  base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text))));

const timeOf = (deps: SyncAuthDeps) => (deps.now?.() ?? new Date()).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

type Purpose = "create" | "add" | "authenticate";

async function saveChallenge(
  deps: SyncAuthDeps,
  challenge: string,
  purpose: Purpose,
  accountId: string | null,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = timeOf(deps);
  await deps.db.batch([
    deps.db.prepare("DELETE FROM challenges WHERE expires_at < ?").bind(iso(now)),
    deps.db
      .prepare(
        "INSERT INTO challenges (id, challenge, purpose, account_id, expires_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(id, challenge, purpose, accountId, iso(now + CHALLENGE_MS)),
  ]);
  return id;
}

/** The challenge, removed so that it is used once; `undefined` when gone, expired or for another purpose. */
async function takeChallenge(
  deps: SyncAuthDeps,
  id: string,
  purposes: readonly Purpose[],
): Promise<{ challenge: string; purpose: Purpose; accountId: string | null } | undefined> {
  const row = await deps.db
    .prepare("SELECT challenge, purpose, account_id, expires_at FROM challenges WHERE id = ?")
    .bind(id)
    .first<{
      challenge: string;
      purpose: Purpose;
      account_id: string | null;
      expires_at: string;
    }>();
  if (!row) return undefined;
  await deps.db.prepare("DELETE FROM challenges WHERE id = ?").bind(id).run();
  if (row.expires_at < iso(timeOf(deps)) || !purposes.includes(row.purpose)) return undefined;
  return { challenge: row.challenge, purpose: row.purpose, accountId: row.account_id };
}

async function newSession(deps: SyncAuthDeps, accountId: string) {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  return {
    token,
    statement: deps.db
      .prepare("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
      .bind(await sha256(token), accountId, iso(timeOf(deps) + SESSION_MS)),
  };
}

export type SyncRegistrationOptions = {
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
};

/**
 * The options for a new passkey: of a new account once Turnstile let the request through, or of
 * the account logged in with the recovery code, whose passkeys were lost.
 */
export async function registrationOptions(
  deps: SyncAuthDeps,
  request:
    | { turnstileToken: string; verifyToken: (token: string) => Promise<TurnstileResult> }
    | { accountId: string },
): Promise<SyncRegistrationOptions | undefined> {
  let accountId: string;
  let purpose: Purpose;
  if ("accountId" in request) {
    accountId = request.accountId;
    purpose = "add";
  } else {
    if (!(await request.verifyToken(request.turnstileToken)).ok) return undefined;
    accountId = crypto.randomUUID();
    purpose = "create";
  }
  // Told apart in the password manager by the day it was made, the only thing it shows.
  const name = `${SITE_NAME}（${iso(timeOf(deps)).slice(0, 10)}）`;
  const options = await generateRegistrationOptions({
    rpName: SITE_NAME,
    rpID: deps.rpID,
    userName: name,
    userDisplayName: name,
    userID: encoder.encode(accountId),
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    // The browser is asked for the PRF on the device, which adds its own salt.
    extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
  });
  const challengeId = await saveChallenge(deps, options.challenge, purpose, accountId);
  return { challengeId, options };
}

export type SyncSession = { accountId: string; credentialId: string; sessionToken: string };

/**
 * Checks the new passkey and keeps it, with a new account and its recovery code's verifier and
 * wrapped secret when the account is new. `undefined` when the passkey or the challenge fails.
 */
export async function register(
  deps: SyncAuthDeps,
  request: {
    challengeId: string;
    response: RegistrationResponseJSON;
    recovery?: { verifier: string; wrap: string };
  },
): Promise<SyncSession | undefined> {
  const challenge = await takeChallenge(deps, request.challengeId, ["create", "add"]);
  if (!challenge?.accountId) return undefined;
  if (challenge.purpose === "create" && !request.recovery) return undefined;
  const verify = deps.verifyRegistration ?? verifyRegistrationResponse;
  const verified = await verify({
    response: request.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: deps.origin,
    expectedRPID: deps.rpID,
    requireUserVerification: true,
  }).catch(() => undefined);
  if (!verified?.verified) return undefined;

  const { credential } = verified.registrationInfo;
  const now = iso(timeOf(deps));
  const accountId = challenge.accountId;
  const session = await newSession(deps, accountId);
  await deps.db.batch([
    ...(challenge.purpose === "create" && request.recovery
      ? [
          deps.db
            .prepare(
              "INSERT INTO accounts (id, created_at, schema_version, recovery_verifier, recovery_wrap) VALUES (?, ?, 0, ?, ?)",
            )
            .bind(accountId, now, request.recovery.verifier, request.recovery.wrap),
        ]
      : []),
    deps.db
      .prepare(
        "INSERT INTO credentials (id, account_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        credential.id,
        accountId,
        base64Url(credential.publicKey),
        credential.counter,
        JSON.stringify(credential.transports ?? []),
        now,
      ),
    session.statement,
  ]);
  return { accountId, credentialId: credential.id, sessionToken: session.token };
}

export type SyncAuthenticationOptions = {
  challengeId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
};

/** The options for logging in with any of the site's passkeys, which the user picks. */
export async function authenticationOptions(
  deps: SyncAuthDeps,
): Promise<SyncAuthenticationOptions> {
  const options = await generateAuthenticationOptions({
    rpID: deps.rpID,
    userVerification: "required",
    allowCredentials: [],
  });
  return {
    challengeId: await saveChallenge(deps, options.challenge, "authenticate", null),
    options,
  };
}

export type SyncLogin = SyncSession & {
  /** The secret wrapped with this passkey's PRF output, if one was kept. */
  prfWrap: string | null;
  recoveryWrap: string;
};

/** Checks the passkey's response and logs in to its account. */
export async function authenticate(
  deps: SyncAuthDeps,
  request: { challengeId: string; response: AuthenticationResponseJSON },
): Promise<SyncLogin | undefined> {
  const challenge = await takeChallenge(deps, request.challengeId, ["authenticate"]);
  if (!challenge) return undefined;
  const stored = await deps.db
    .prepare(
      "SELECT c.account_id, c.public_key, c.counter, c.transports, c.prf_wrap, a.recovery_wrap FROM credentials c JOIN accounts a ON a.id = c.account_id WHERE c.id = ?",
    )
    .bind(request.response.id)
    .first<{
      account_id: string;
      public_key: string;
      counter: number;
      transports: string | null;
      prf_wrap: string | null;
      recovery_wrap: string;
    }>();
  if (!stored) return undefined;
  const verify = deps.verifyAuthentication ?? verifyAuthenticationResponse;
  const verified = await verify({
    response: request.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: deps.origin,
    expectedRPID: deps.rpID,
    requireUserVerification: true,
    credential: {
      id: request.response.id,
      publicKey: fromBase64Url(stored.public_key),
      counter: stored.counter,
      transports: JSON.parse(stored.transports ?? "[]"),
    },
  }).catch(() => undefined);
  if (!verified?.verified) return undefined;

  const session = await newSession(deps, stored.account_id);
  await deps.db.batch([
    deps.db
      .prepare("UPDATE credentials SET counter = ? WHERE id = ?")
      .bind(verified.authenticationInfo.newCounter, request.response.id),
    session.statement,
  ]);
  return {
    accountId: stored.account_id,
    credentialId: request.response.id,
    sessionToken: session.token,
    prfWrap: stored.prf_wrap,
    recoveryWrap: stored.recovery_wrap,
  };
}

/** Logs in with the recovery code's verifier, for a user whose passkeys are gone. */
export async function loginWithRecovery(
  deps: SyncAuthDeps,
  verifier: string,
): Promise<{ accountId: string; sessionToken: string; recoveryWrap: string } | undefined> {
  const account = await deps.db
    .prepare("SELECT id, recovery_wrap FROM accounts WHERE recovery_verifier = ?")
    .bind(verifier)
    .first<{ id: string; recovery_wrap: string }>();
  if (!account) return undefined;
  const session = await newSession(deps, account.id);
  await session.statement.run();
  return {
    accountId: account.id,
    sessionToken: session.token,
    recoveryWrap: account.recovery_wrap,
  };
}

/**
 * Keeps the secret wrapped with a passkey's PRF output. A passkey that has one keeps it: a device
 * whose PRF gives another output would otherwise lock out the devices that open it.
 */
export async function setPrfWrap(
  deps: SyncAuthDeps,
  accountId: string,
  credentialId: string,
  prfWrap: string,
): Promise<boolean> {
  const { meta } = await deps.db
    .prepare(
      "UPDATE credentials SET prf_wrap = ? WHERE id = ? AND account_id = ? AND prf_wrap IS NULL",
    )
    .bind(prfWrap, credentialId, accountId)
    .run();
  return meta.changes > 0;
}

/** The account a session token is logged in to, which stays logged in for another 400 days. */
export async function sessionAccount(
  deps: SyncAuthDeps,
  token: string | undefined,
): Promise<string | undefined> {
  if (!token) return undefined;
  const hash = await sha256(token);
  const now = timeOf(deps);
  const row = await deps.db
    .prepare("SELECT account_id FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(hash, iso(now))
    .first<{ account_id: string }>();
  if (!row) return undefined;
  await deps.db
    .prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?")
    .bind(iso(now + SESSION_MS), hash)
    .run();
  return row.account_id;
}

/** Logs the session out. */
export async function endSession(deps: SyncAuthDeps, token: string): Promise<void> {
  await deps.db
    .prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(await sha256(token))
    .run();
}
