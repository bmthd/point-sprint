import { describe, expect, test, vi } from "vitest";
import { ALLOWED_ORIGIN } from "../rakuten/config";
import { type ItemLookupDeps, handleItemLookup } from "./item-lookup";
import { type Turn, takeTurn } from "./rate-gate";

// Neither the Durable Object nor the Rakuten API is reached: both are stood in for here.

describe("the turns at the API", () => {
  const NOW = 1_000_000;

  test("a free gate gives a turn at once and keeps the next one 100ms later", () => {
    expect(takeTurn(0, NOW, 5000)).toEqual({
      turn: { granted: true, waitMs: 0 },
      nextFreeAt: NOW + 100,
    });
  });

  test("turns taken one after another are 100ms apart", () => {
    let nextFreeAt = 0;
    const waits: number[] = [];
    for (let i = 0; i < 4; i++) {
      const taken = takeTurn(nextFreeAt, NOW, 5000);
      nextFreeAt = taken.nextFreeAt;
      waits.push(taken.turn.waitMs);
    }
    expect(waits).toEqual([0, 100, 200, 300]);
    expect(nextFreeAt).toBe(NOW + 400);
  });

  test("a turn exactly `maxWaitMs` away is taken, one further is not", () => {
    expect(takeTurn(NOW + 5000, NOW, 5000)).toEqual({
      turn: { granted: true, waitMs: 5000 },
      nextFreeAt: NOW + 5100,
    });
    expect(takeTurn(NOW + 5001, NOW, 5000)).toEqual({
      turn: { granted: false, waitMs: 5001 },
      nextFreeAt: NOW + 5001,
    });
  });

  test("a gate left idle starts again from now", () => {
    expect(takeTurn(NOW - 60_000, NOW, 0)).toEqual({
      turn: { granted: true, waitMs: 0 },
      nextFreeAt: NOW + 100,
    });
  });
});

const config = { applicationId: "app-id", accessKey: "access-key", affiliateId: "aff-id" };
const input = { page: { shopCode: "shop-a", itemManageNumber: "item-1" }, maxWaitMs: 5000 };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const apiItem = {
  itemName: "洗濯洗剤 詰め替え",
  itemCode: "shop-a:10000001",
  itemPrice: 2980,
  itemUrl: "https://item.rakuten.co.jp/shop-a/item-1/",
  taxFlag: 0,
  pointRate: 5,
  shopName: "ショップA",
  shopCode: "shop-a",
};

function deps(turn: Turn, overrides: Partial<ItemLookupDeps> = {}) {
  const events: string[] = [];
  const takeTurn = vi.fn<ItemLookupDeps["takeTurn"]>(async () => {
    events.push("turn");
    return turn;
  });
  const wait = vi.fn<(ms: number) => Promise<void>>(async (ms) => {
    events.push(`wait ${ms}`);
  });
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    events.push("fetch");
    return json({ Items: [{ Item: apiItem }] });
  });
  return {
    events,
    takeTurn,
    wait,
    fetch,
    deps: { config, takeTurn, wait, fetch, endpoint: "http://api.test/search", ...overrides },
  };
}

describe("the lookup", () => {
  test("waits for its turn, then calls the API from the allowed origin", async () => {
    const { deps: d, events, takeTurn, fetch } = deps({ granted: true, waitMs: 300 });
    const result = await handleItemLookup(input, d);

    expect(result.ok && result.item.name).toBe("洗濯洗剤 詰め替え");
    expect(takeTurn).toHaveBeenCalledWith(5000);
    expect(events).toEqual(["turn", "wait 300", "fetch"]);
    const request = fetch.mock.calls[0]?.[0] as Request;
    expect(request.headers.get("Origin")).toBe(ALLOWED_ORIGIN);
    const sent = new URL(request.url);
    expect(sent.origin + sent.pathname).toBe("http://api.test/search");
    expect(Object.fromEntries(sent.searchParams)).toMatchObject({
      applicationId: "app-id",
      accessKey: "access-key",
      affiliateId: "aff-id",
      shopCode: "shop-a",
      keyword: "item-1",
    });
  });

  test("calls at once when its turn is now", async () => {
    const { deps: d, events } = deps({ granted: true, waitMs: 0 });
    await handleItemLookup(input, d);
    expect(events).toEqual(["turn", "fetch"]);
  });

  test("says how far away a turn it could not take is, and calls nothing", async () => {
    const { deps: d, events, wait, fetch } = deps({ granted: false, waitMs: 12_300 });
    expect(await handleItemLookup({ ...input, maxWaitMs: 30_000 }, d)).toEqual({
      ok: false,
      error: { reason: "busy", waitMs: 12_300 },
    });
    expect(events).toEqual(["turn"]);
    expect(wait).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("takes no turn without the Rakuten settings", async () => {
    const { deps: d, takeTurn } = deps({ granted: true, waitMs: 0 }, { config: undefined });
    expect(await handleItemLookup(input, d)).toEqual({
      ok: false,
      error: { reason: "unavailable" },
    });
    expect(takeTurn).not.toHaveBeenCalled();
  });

  test("does not call the API once the browser has given up", async () => {
    const aborter = new AbortController();
    const { deps: d, fetch } = deps(
      { granted: true, waitMs: 3000 },
      { wait: async () => aborter.abort(), signal: aborter.signal },
    );
    expect(await handleItemLookup(input, d)).toEqual({ ok: false, error: { reason: "network" } });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("a 429 from the API fails the lookup", async () => {
    const { deps: d } = deps(
      { granted: true, waitMs: 0 },
      { fetch: async () => json({ error: "too_many_requests" }, 429) },
    );
    expect(await handleItemLookup(input, d)).toEqual({
      ok: false,
      error: { reason: "rate-limited" },
    });
  });
});
