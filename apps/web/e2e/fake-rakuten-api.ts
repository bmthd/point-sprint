// A stand-in for the Rakuten item search API, which the E2E build's Worker calls instead
// (`ITEM_LOOKUP_ENDPOINT` in `pnpm build:e2e`). Run by Node, which strips the types.
//
// - `GET /search`: the item `blend-500g` of `coffee-beans` is found; the manage number
//   `rate-limited` is answered with 429; anything else finds nothing.
// - `GET /calls`: every search so far, with its parameters and its `Origin`.
import { createServer } from "node:http";

export const FAKE_RAKUTEN_API_PORT = 4174;

const ITEM_URL = "https://item.rakuten.co.jp/coffee-beans/blend-500g/";

const item = {
  itemName: "ブレンドコーヒー豆 500g",
  itemCode: "coffee-beans:10000123",
  itemPrice: 2160,
  taxFlag: 0,
  itemUrl: `https://hb.afl.rakuten.co.jp/hgc/x/?pc=${encodeURIComponent(ITEM_URL)}`,
  affiliateUrl: `https://hb.afl.rakuten.co.jp/hgc/x/?pc=${encodeURIComponent(ITEM_URL)}`,
  shopName: "コーヒー豆の店",
  shopCode: "coffee-beans",
  pointRate: 3,
};

export type FakeCall = { params: Record<string, string>; origin: string | undefined };

const calls: FakeCall[] = [];

if (process.argv[1] === import.meta.filename) {
  createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (url.pathname === "/calls") return send(200, calls);
    if (url.pathname !== "/search") return send(404, {});
    const params = Object.fromEntries(url.searchParams);
    calls.push({ params, origin: request.headers.origin });
    if (params.keyword === "rate-limited") {
      return send(429, { error: "too_many_requests", error_description: "Rate limit is exceeded" });
    }
    const found = params.shopCode === "coffee-beans" && params.keyword === "blend-500g";
    return send(200, { count: found ? 1 : 0, Items: found ? [{ Item: item }] : [] });
  }).listen(FAKE_RAKUTEN_API_PORT, "127.0.0.1");
}
