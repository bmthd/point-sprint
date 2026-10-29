import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import type { Notice } from "../-notices/notices";
import { ReleaseLink } from "./release-link";

const notice = (id: string, date: string, version?: string): Notice => ({
  id,
  date,
  title: id,
  body: "本文",
  ...(version === undefined ? {} : { release: { version, changesCalculation: false } }),
});

async function renderLink(notices: Notice[]) {
  await cleanup();
  const root = createRootRoute({
    component: () => (
      <ReleaseLink notices={notices} now={() => new Date("2026-10-26T12:00:00+09:00")} />
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await render(
    <UIProvider theme={theme} config={config}>
      <RouterProvider router={router} />
    </UIProvider>,
  );
}

test("the header links to the notice of the latest version", async () => {
  await renderLink([
    notice("first", "2026-10-01", "1.0"),
    notice("later-news", "2026-10-30"),
    notice("second", "2026-10-25", "1.1"),
  ]);
  const link = page.getByRole("link", { name: "Ver.1.1、10月25日に更新。更新のお知らせを見る" });
  await expect.element(link).toHaveAttribute("href", "/notices#second");
});

test("the header has no version until a notice raises it", async () => {
  await renderLink([notice("news", "2026-10-01")]);
  await expect.element(page.getByRole("link")).not.toBeInTheDocument();
});
