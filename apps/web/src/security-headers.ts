// Response headers every page carries. The Worker adds them to what it renders (src/start.ts);
// `public/_headers` adds them to the prerendered pages and other static assets, which are served
// without the Worker. No full Content-Security-Policy: Google Analytics, AdSense and Turnstile load
// from many origins.
export const securityHeaders = {
  // No site may frame the pages; `X-Frame-Options` for browsers without `frame-ancestors`.
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
} as const satisfies Record<string, string>;

/** Sets `securityHeaders` on `headers`, replacing any value already there. */
export function setSecurityHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
}
