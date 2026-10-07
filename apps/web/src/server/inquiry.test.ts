import { describe, expect, test, vi } from "vitest";
import { type InquiryDeps, handleInquiry } from "./inquiry";
import { INQUIRY_FROM, INQUIRY_SUBJECT, buildInquiryMail, encodeHeaderValue } from "./inquiry-mail";
import { SITEVERIFY_ENDPOINT, type TurnstileResult, verifyTurnstile } from "./turnstile";

// Neither `siteverify` nor the `send_email` binding is reached: both are stood in for here.

const OPERATOR = "operator@example.com";
const SENT_AT = new Date("2026-10-07T12:05:00Z");

const inquiry = {
  name: "山田 太郎",
  email: "user@example.com",
  wantsReply: true,
  body: "計算が合いません。\n2行目",
};
const request = { ...inquiry, turnstileToken: "token-from-widget" };

/** Decodes MIME encoded-words back to text. */
const decodeHeader = (value: string) =>
  value
    .split(/\r\n /)
    .map((word) => /^=\?UTF-8\?B\?(.*)\?=$/.exec(word)?.[1] ?? "")
    .map((b64) => Uint8Array.from(atob(b64), (char) => char.charCodeAt(0)))
    .reduce((text, bytes) => text + new TextDecoder().decode(bytes), "");

/** A raw message's headers (unfolded) and its decoded text body. */
function parseMail(raw: string) {
  const [head = "", body = ""] = raw.split("\r\n\r\n");
  // A folded value goes on in lines that start with a space.
  const headers: Record<string, string> = {};
  let last = "";
  for (const line of head.split("\r\n")) {
    if (line.startsWith(" ")) {
      headers[last] += `\r\n${line}`;
      continue;
    }
    const at = line.indexOf(": ");
    last = line.slice(0, at);
    headers[last] = line.slice(at + 2);
  }
  const bytes = Uint8Array.from(atob(body.replace(/\r\n/g, "")), (char) => char.charCodeAt(0));
  return { headers, text: new TextDecoder().decode(bytes), body };
}

describe("the mail", () => {
  test("leaves plain ASCII headers as they are", () => {
    expect(encodeHeaderValue("Inquiry")).toBe("Inquiry");
  });

  test("encodes Japanese in words of at most 75 characters, cut between characters", () => {
    const subject = "お問い合わせ".repeat(6);
    const encoded = encodeHeaderValue(subject);
    const words = encoded.split("\r\n ");
    expect(words.length).toBeGreaterThan(1);
    for (const word of words) expect(word.length).toBeLessThanOrEqual(75);
    expect(decodeHeader(encoded)).toBe(subject);
  });

  test("goes from the inquiry address to the operator, with the user as Reply-To", () => {
    const raw = buildInquiryMail({
      inquiry,
      to: OPERATOR,
      sentAt: SENT_AT,
      messageId: "id@bmth.dev",
    });
    const { headers, text, body } = parseMail(raw);
    expect(headers.From).toMatch(new RegExp(`^=\\?UTF-8\\?B\\?.+\\?= <${INQUIRY_FROM}>$`));
    expect(decodeHeader((headers.From ?? "").replace(/ <.*>$/, ""))).toBe("ポイントスプリント");
    expect(headers.To).toBe(`<${OPERATOR}>`);
    expect(headers["Reply-To"]).toBe("<user@example.com>");
    expect(decodeHeader(headers.Subject ?? "")).toBe(INQUIRY_SUBJECT);
    expect(headers.Date).toBe("Wed, 07 Oct 2026 12:05:00 GMT");
    expect(headers["Message-ID"]).toBe("<id@bmth.dev>");
    expect(headers["Content-Type"]).toBe("text/plain; charset=UTF-8");
    expect(headers["Content-Transfer-Encoding"]).toBe("base64");
    for (const line of body.split("\r\n")) expect(line.length).toBeLessThanOrEqual(76);
    expect(text).toContain("名前: 山田 太郎\r\n返信先: user@example.com\r\n返信: 希望する\r\n");
    expect(text).toContain("送信日時: 2026-10-07 21:05（日本時間）");
    expect(text).toContain("内容:\r\n計算が合いません。\r\n2行目\r\n");
    expect(raw).not.toMatch(/[^\r]\n/);
  });

  test("says so when no name was given", () => {
    const raw = buildInquiryMail({
      inquiry: { ...inquiry, name: "" },
      to: OPERATOR,
      sentAt: SENT_AT,
      messageId: "id@bmth.dev",
    });
    expect(parseMail(raw).text).toContain("名前: （なし）");
  });

  test("says when no reply is wanted", () => {
    const raw = buildInquiryMail({
      inquiry: { ...inquiry, wantsReply: false },
      to: OPERATOR,
      sentAt: SENT_AT,
      messageId: "id@bmth.dev",
    });
    expect(parseMail(raw).text).toContain("返信: 希望しない");
  });
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("siteverify", () => {
  test("posts the secret, the token and the user's IP", async () => {
    const sent: { method: string; url: string; body: string }[] = [];
    // ky passes a `Request`, whose body can be read once.
    const fetcher = async (input: RequestInfo | URL) => {
      const request = input as Request;
      sent.push({ method: request.method, url: request.url, body: await request.text() });
      return json({ success: true, "error-codes": [] });
    };
    expect(
      await verifyTurnstile("token", "secret", { remoteIp: "203.0.113.1", fetch: fetcher }),
    ).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe("POST");
    expect(sent[0]?.url).toBe(SITEVERIFY_ENDPOINT);
    expect(Object.fromEntries(new URLSearchParams(sent[0]?.body))).toEqual({
      secret: "secret",
      response: "token",
      remoteip: "203.0.113.1",
    });
  });

  test("tells a rejected token from a failed call", async () => {
    const answering = (response: Response | Error) =>
      verifyTurnstile("token", "secret", {
        fetch: async () => {
          if (response instanceof Error) throw response;
          return response;
        },
      });
    expect(
      await answering(json({ success: false, "error-codes": ["invalid-input-response"] })),
    ).toEqual({ ok: false, error: { reason: "rejected", errorCodes: ["invalid-input-response"] } });
    expect(await answering(json({}, 500))).toEqual({
      ok: false,
      error: { reason: "http", status: 500 },
    });
    expect(await answering(json({ ok: 1 }))).toEqual({
      ok: false,
      error: { reason: "invalid-response" },
    });
    expect(await answering(new TypeError("fetch failed"))).toEqual({
      ok: false,
      error: { reason: "network" },
    });
  });
});

describe("an inquiry", () => {
  const deps = (overrides: Partial<InquiryDeps> = {}) => {
    const log = vi.fn<(message: string) => void>();
    const send = vi.fn<InquiryDeps["send"]>(async () => {});
    const verifyToken = vi.fn<InquiryDeps["verifyToken"]>(async (): Promise<TurnstileResult> => ({
      ok: true,
    }));
    return {
      log,
      send,
      verifyToken,
      deps: {
        turnstileSecret: "secret",
        destination: OPERATOR,
        verifyToken,
        send,
        log,
        now: () => SENT_AT,
        messageId: () => "id@bmth.dev",
        ...overrides,
      } satisfies InquiryDeps,
    };
  };

  /** Nothing the user wrote is in the log. */
  const expectNothingOfTheUserLogged = (log: ReturnType<typeof deps>["log"]) => {
    const logged = log.mock.calls.flat().join("\n");
    for (const value of [inquiry.name, inquiry.email, "計算が合いません", request.turnstileToken]) {
      expect(logged).not.toContain(value);
    }
  };

  test("is sent to the operator once the token is good", async () => {
    const { deps: d, send, verifyToken, log } = deps();
    expect(await handleInquiry(request, d)).toEqual({ ok: true });
    expect(verifyToken).toHaveBeenCalledWith("token-from-widget", "secret");
    expect(send).toHaveBeenCalledTimes(1);
    const [message] = send.mock.calls[0] ?? [];
    expect(message?.from).toBe(INQUIRY_FROM);
    expect(message?.to).toBe(OPERATOR);
    expect(message?.raw).toBe(
      buildInquiryMail({ inquiry, to: OPERATOR, sentAt: SENT_AT, messageId: "id@bmth.dev" }),
    );
    expect(log).not.toHaveBeenCalled();
  });

  test("trims the input before sending it", async () => {
    const { deps: d, send } = deps();
    await handleInquiry({ ...request, name: "  ", email: " user@example.com " }, d);
    expect(parseMail(send.mock.calls[0]?.[0].raw ?? "").headers["Reply-To"]).toBe(
      "<user@example.com>",
    );
  });

  test.each([
    ["no reply address", { ...request, email: "" }, "email"],
    [
      "an address that is not one",
      { ...request, email: "user@example.com\r\nBcc: x@example.com" },
      "email",
    ],
    ["no message", { ...request, body: "   " }, "body"],
    ["no token", { ...request, turnstileToken: "" }, "turnstileToken"],
    ["something that is not an inquiry", "hello", "(root)"],
  ])("stops at the input with %s", async (_, input, path) => {
    const { deps: d, send, verifyToken, log } = deps();
    expect(await handleInquiry(input, d)).toEqual({ ok: false, stage: "input" });
    expect(verifyToken).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(`inquiry failed at input: ${path}`);
    expectNothingOfTheUserLogged(log);
  });

  test.each([
    ["the Turnstile secret", { turnstileSecret: undefined }, "TURNSTILE_SECRET_KEY"],
    ["the operator's address", { destination: "" }, "INQUIRY_TO_ADDRESS"],
  ])("stops at the config without %s", async (_, overrides, name) => {
    const { deps: d, send, verifyToken, log } = deps(overrides);
    expect(await handleInquiry(request, d)).toEqual({ ok: false, stage: "config" });
    expect(verifyToken).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(log.mock.calls[0]?.[0]).toContain(name);
  });

  test("stops at Turnstile when the token is not good, and sends nothing", async () => {
    const {
      deps: d,
      send,
      log,
    } = deps({
      verifyToken: async () => ({
        ok: false,
        error: { reason: "rejected", errorCodes: ["timeout-or-duplicate"] },
      }),
    });
    expect(await handleInquiry(request, d)).toEqual({ ok: false, stage: "turnstile" });
    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "inquiry failed at turnstile: rejected (timeout-or-duplicate)",
    );
    expectNothingOfTheUserLogged(log);
  });

  test("stops at Turnstile when siteverify cannot be reached", async () => {
    const { deps: d, log } = deps({
      verifyToken: async () => ({ ok: false, error: { reason: "http", status: 503 } }),
    });
    expect(await handleInquiry(request, d)).toEqual({ ok: false, stage: "turnstile" });
    expect(log).toHaveBeenCalledWith("inquiry failed at turnstile: http 503");
  });

  test("stops at sending when the binding throws", async () => {
    const { deps: d, log } = deps({
      send: async () => {
        throw new Error("destination address is not a verified address");
      },
    });
    expect(await handleInquiry(request, d)).toEqual({ ok: false, stage: "send" });
    expect(log).toHaveBeenCalledWith(
      "inquiry failed at send: destination address is not a verified address",
    );
    expectNothingOfTheUserLogged(log);
  });
});
