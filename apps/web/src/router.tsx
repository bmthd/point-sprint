import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // "root": a URL under a layout route (`/help/x`) gets the same not-found page, in the root's head.
  return createRouter({ routeTree, scrollRestoration: true, notFoundMode: "root" });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
