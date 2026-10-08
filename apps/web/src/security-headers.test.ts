import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { securityHeaders, setSecurityHeaders } from "./security-headers";

test("public/_headers sets the security headers on every static file", () => {
  const text = readFileSync(join(import.meta.dirname, "../public/_headers"), "utf8");
  const rules = text.split("\n").filter((line) => line.trim() !== "" && !line.startsWith("#"));
  expect(rules).toEqual([
    "/*",
    ...Object.entries(securityHeaders).map(([name, value]) => `  ${name}: ${value}`),
  ]);
});

test("sets the security headers on a response, keeping its own", () => {
  const response = new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain", "referrer-policy": "no-referrer" },
  });
  setSecurityHeaders(response.headers);
  expect(Object.fromEntries(response.headers)).toEqual({
    "content-type": "text/plain",
    "content-security-policy": "frame-ancestors 'none'",
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
});
