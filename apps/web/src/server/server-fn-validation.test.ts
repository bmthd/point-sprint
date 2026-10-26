import * as v from "valibot";
import { expect, test, vi } from "vitest";
import { getGuide } from "../guides/get-guide";
import { guideSlugs } from "../guides/files";
import {
  syncStartOptions,
  syncRegister,
  syncLogin,
  syncRecoveryLogin,
  syncSetPrfWrap,
  syncPush,
  syncPull,
  syncReissueRecovery,
} from "./sync-functions";

// Server functions are compiler-transformed in the app. Here only the boundary runs;
// handlers would load the Workers runtime and perform network/database operations.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: v.GenericSchema | ((input: unknown) => unknown) = (input) => input;
    const builder = {
      validator: (schema: typeof validator) => {
        validator = schema;
        return builder;
      },
      handler:
        () =>
        async ({ data }: { data: unknown }) => {
          if (typeof validator === "function") return validator(data);
          const result = await validator["~standard"].validate(data);
          if (result.issues) throw new Error(JSON.stringify(result.issues));
          return result.value;
        },
    };
    return builder;
  },
}));

const validate = (fn: (...args: never[]) => unknown, data: unknown): Promise<unknown> =>
  Reflect.apply(fn, undefined, [{ data }]);

test.each(["", "../secret", "a/b", "UPPER", "a_b", "-guide", "guide-", "a--b", 42, null])(
  "getGuide rejects malformed slug %j",
  async (slug) => {
    await expect(validate(getGuide, slug)).rejects.toThrow();
  },
);

test("getGuide accepts existing slugs and well-formed unknown slugs for the not-found handler", async () => {
  for (const slug of [...guideSlugs(), "no-such-guide"]) {
    await expect(validate(getGuide, slug)).resolves.toBe(slug);
  }
});

const response = {
  id: "credential",
  rawId: "raw",
  type: "public-key",
  response: { clientDataJSON: "data" },
  clientExtensionResults: {},
};

test.each([
  [syncStartOptions, { turnstileToken: 1 }],
  [syncRegister, { challengeId: "challenge", response: { ...response, type: "wrong" } }],
  [
    syncLogin,
    {
      challengeId: "challenge",
      response: { ...response, clientExtensionResults: { prf: { results: {} } } },
    },
  ],
  [syncRecoveryLogin, { verifier: 1 }],
  [syncSetPrfWrap, { credentialId: "credential", prfWrap: 1 }],
  [
    syncPush,
    {
      records: [
        { recordId: "record", updatedAt: "invalid", version: 1, deleted: false, body: "body" },
      ],
    },
  ],
  [syncPull, { since: -1 }],
  [syncPull, { since: 0.5 }],
  [syncReissueRecovery, { accountId: "account", verifier: "short", wrap: "short" }],
])("sync boundary rejects malformed input %#", async (fn, data) => {
  await expect(validate(fn, data)).rejects.toThrow();
});

test.each([
  [syncStartOptions, { turnstileToken: "token" }],
  [
    syncRegister,
    { challengeId: "challenge", response, recovery: { verifier: "verifier", wrap: "wrap" } },
  ],
  [syncLogin, { challengeId: "challenge", response }],
  [syncRecoveryLogin, { verifier: "verifier" }],
  [syncSetPrfWrap, { credentialId: "credential", prfWrap: "wrap" }],
  [
    syncPush,
    {
      records: [
        {
          recordId: "record",
          updatedAt: "2026-10-01T00:00:00Z",
          version: 1,
          deleted: false,
          body: "body",
        },
      ],
    },
  ],
  [syncPull, { since: 0 }],
  [syncReissueRecovery, { accountId: "account", verifier: "a".repeat(43), wrap: "b".repeat(80) }],
])("sync boundary preserves valid input %#", async (fn, data) => {
  await expect(validate(fn, data)).resolves.toEqual(data);
});
