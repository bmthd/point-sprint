import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { setSecurityHeaders } from "./security-headers";

// Start drops its default CSRF check on server functions once `start.ts` exists, so it is listed.
const csrfMiddleware = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

/**
 * Sets the security headers on every response the Worker renders, like `/share`. On the response
 * itself: Start's `setResponseHeaders` reaches only 2xx responses, not a 404 page.
 */
const securityHeadersMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
  const result = await next();
  setSecurityHeaders(result.response.headers);
  return result;
});

export const startInstance = createStart(() => ({
  // The headers first, so they reach the CSRF check's rejection too.
  requestMiddleware: [securityHeadersMiddleware, csrfMiddleware],
}));
