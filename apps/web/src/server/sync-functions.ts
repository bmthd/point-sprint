import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import type { SyncAuthenticationOptions, SyncRegistrationOptions } from "./sync-auth";
import type { PullResult, PushResult, RemoteRecord } from "./sync-records";

// The server functions of sync, run by the Worker. Each loads its modules in the handler: they
// import the Workers runtime, which tests that import this module lack.

const ResponseSchema = v.looseObject({
  id: v.string(),
  rawId: v.string(),
  type: v.literal("public-key"),
  response: v.looseObject({ clientDataJSON: v.string() }),
  // The PRF's output stays on the device: a response that carries it is refused.
  clientExtensionResults: v.pipe(
    v.looseObject({}),
    v.check(
      (results) => !("prf" in results) || !(results.prf as { results?: unknown })?.results,
      "the PRF's output must not be sent",
    ),
  ),
});

const RecordSchema = v.object({
  recordId: v.pipe(v.string(), v.maxLength(64)),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
  deleted: v.boolean(),
  body: v.string(),
});

const parse =
  <S extends v.GenericSchema>(schema: S) =>
  (data: unknown): v.InferOutput<S> =>
    v.parse(schema, data);

export type SignedOut = { ok: false; reason: "signed-out" };
const signedOut: SignedOut = { ok: false, reason: "signed-out" };

/** The options for the passkey of a new account, once Turnstile let the request through. */
export const syncStartOptions = createServerFn({ method: "POST" })
  .validator(parse(v.object({ turnstileToken: v.string() })))
  .handler(async ({ data }): Promise<SyncRegistrationOptions | undefined> => {
    const [{ syncDeps, turnstileVerifier }, { registrationOptions }] = await Promise.all([
      import("./worker-sync"),
      import("./sync-auth"),
    ]);
    return registrationOptions(await syncDeps(), {
      turnstileToken: data.turnstileToken,
      verifyToken: turnstileVerifier,
    });
  });

/** The options for another passkey of the account logged in, after the recovery code. */
export const syncAddPasskeyOptions = createServerFn({ method: "POST" }).handler(
  async (): Promise<SyncRegistrationOptions | SignedOut> => {
    const [{ syncDeps, sessionOf }, { registrationOptions }] = await Promise.all([
      import("./worker-sync"),
      import("./sync-auth"),
    ]);
    const deps = await syncDeps();
    const accountId = await sessionOf(deps);
    if (!accountId) return signedOut;
    return (await registrationOptions(deps, { accountId })) ?? signedOut;
  },
);

/** Keeps the new passkey, and the new account with it, and logs in. */
export const syncRegister = createServerFn({ method: "POST" })
  .validator(
    parse(
      v.object({
        challengeId: v.string(),
        response: ResponseSchema,
        recovery: v.optional(v.object({ verifier: v.string(), wrap: v.string() })),
      }),
    ),
  )
  .handler(async ({ data }) => {
    const [{ syncDeps, setSessionCookie }, { register }] = await Promise.all([
      import("./worker-sync"),
      import("./sync-auth"),
    ]);
    const session = await register(await syncDeps(), {
      challengeId: data.challengeId,
      response: data.response as unknown as RegistrationResponseJSON,
      ...(data.recovery ? { recovery: data.recovery } : {}),
    });
    if (!session) return undefined;
    setSessionCookie(session.sessionToken);
    return { accountId: session.accountId, credentialId: session.credentialId };
  });

/** The options for logging in with a passkey. */
export const syncLoginOptions = createServerFn({ method: "POST" }).handler(
  async (): Promise<SyncAuthenticationOptions> => {
    const [{ syncDeps }, { authenticationOptions }] = await Promise.all([
      import("./worker-sync"),
      import("./sync-auth"),
    ]);
    return authenticationOptions(await syncDeps());
  },
);

/** Logs in with a passkey, and gives the secret's wraps to open on the device. */
export const syncLogin = createServerFn({ method: "POST" })
  .validator(parse(v.object({ challengeId: v.string(), response: ResponseSchema })))
  .handler(async ({ data }) => {
    const [{ syncDeps, setSessionCookie }, { authenticate }] = await Promise.all([
      import("./worker-sync"),
      import("./sync-auth"),
    ]);
    const login = await authenticate(await syncDeps(), {
      challengeId: data.challengeId,
      response: data.response as unknown as AuthenticationResponseJSON,
    });
    if (!login) return undefined;
    setSessionCookie(login.sessionToken);
    const { sessionToken: _, ...rest } = login;
    return rest;
  });

/** Logs in with the recovery code's verifier. */
export const syncRecoveryLogin = createServerFn({ method: "POST" })
  .validator(parse(v.object({ verifier: v.string() })))
  .handler(async ({ data }) => {
    const [{ syncDeps, setSessionCookie }, { loginWithRecovery }] = await Promise.all([
      import("./worker-sync"),
      import("./sync-auth"),
    ]);
    const login = await loginWithRecovery(await syncDeps(), data.verifier);
    if (!login) return undefined;
    setSessionCookie(login.sessionToken);
    return { accountId: login.accountId, recoveryWrap: login.recoveryWrap };
  });

/** Keeps the secret wrapped with a passkey's PRF output, unless the passkey has one. */
export const syncSetPrfWrap = createServerFn({ method: "POST" })
  .validator(parse(v.object({ credentialId: v.string(), prfWrap: v.string() })))
  .handler(async ({ data }): Promise<boolean> => {
    const [{ syncDeps, sessionOf }, { setPrfWrap }] = await Promise.all([
      import("./worker-sync"),
      import("./sync-auth"),
    ]);
    const deps = await syncDeps();
    const accountId = await sessionOf(deps);
    return accountId ? setPrfWrap(deps, accountId, data.credentialId, data.prfWrap) : false;
  });

export const syncPush = createServerFn({ method: "POST" })
  .validator(parse(v.object({ records: v.array(RecordSchema) })))
  .handler(async ({ data }): Promise<PushResult | SignedOut> => {
    const [{ syncDeps, sessionOf }, { push }] = await Promise.all([
      import("./worker-sync"),
      import("./sync-records"),
    ]);
    const deps = await syncDeps();
    const accountId = await sessionOf(deps);
    if (!accountId) return signedOut;
    return push(deps, accountId, data.records as RemoteRecord[]);
  });

export const syncPull = createServerFn({ method: "POST" })
  .validator(parse(v.object({ since: v.pipe(v.number(), v.integer(), v.minValue(0)) })))
  .handler(async ({ data }): Promise<({ ok: true } & PullResult) | SignedOut> => {
    const [{ syncDeps, sessionOf }, { pull }] = await Promise.all([
      import("./worker-sync"),
      import("./sync-records"),
    ]);
    const deps = await syncDeps();
    const accountId = await sessionOf(deps);
    if (!accountId) return signedOut;
    return { ok: true, ...(await pull(deps, accountId, data.since)) };
  });

/** Removes everything kept for the account logged in, and logs out. */
export const syncStop = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true } | SignedOut> => {
    const [{ syncDeps, sessionOf, clearSessionCookie }, { deleteAccount }] = await Promise.all([
      import("./worker-sync"),
      import("./sync-records"),
    ]);
    const deps = await syncDeps();
    const accountId = await sessionOf(deps);
    if (!accountId) return signedOut;
    await deleteAccount(deps, accountId);
    clearSessionCookie();
    return { ok: true };
  },
);
