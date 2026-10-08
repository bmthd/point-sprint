import { securityHeaders } from "../src/security-headers";
import { expect, test } from "./fixtures";

// Prerendered pages and files get them from `public/_headers`; pages the Worker renders, its 404
// included, from the request middleware in src/start.ts.
test("every response carries the security headers", async ({ request }) => {
  const expected = Object.fromEntries(
    Object.entries(securityHeaders).map(([name, value]) => [name.toLowerCase(), value]),
  );
  for (const path of [
    "/",
    "/help",
    "/robots.txt",
    "/share?points=2600&rate=6.5",
    "/no-such-page",
  ]) {
    const headers = (await request.get(path)).headers();
    expect(headers, path).toMatchObject(expected);
  }
});
