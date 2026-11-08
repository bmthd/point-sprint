import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { QueryClientAtomProvider } from "jotai-tanstack-query/react";
import { useHydrateAtoms } from "jotai/utils";
import type { ReactNode } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import type { RecentArticle } from "#/guides/recent-articles.ts";
import { repositoryAtom } from "#/state/repository.ts";
import { createMemoryRepository } from "#/storage/memory-repository.ts";
import type { Repository } from "#/storage/repository.ts";
import { expectTexts } from "#/test-texts.ts";
import type { Notice } from "#/routes/-notices/notices.ts";
import { NoticesPage } from "./notices-page";

const notice = (date: string, title: string): Notice => ({
  id: `notice-${date}`,
  date,
  title,
  body: `${title}の本文です。\n\n2段落目です。`,
});

function Hydrate({ repository, children }: { repository: Repository; children: ReactNode }) {
  useHydrateAtoms([[repositoryAtom, repository]]);
  return children;
}

const recentArticles: RecentArticle[] = [
  { slug: "buying-order", title: "買う順番", date: "2026-10-20" },
];

/** `/notices` in a router with a memory history. */
async function renderAt(
  path: string,
  notices: Notice[],
  repository: Repository = createMemoryRepository(),
) {
  await cleanup();
  const root = createRootRoute({ component: Outlet, loader: () => ({ recentArticles }) });
  const noticesRoute = createRoute({
    getParentRoute: () => root,
    path: "/notices",
    component: () => <NoticesPage notices={notices} />,
  });
  const router = createRouter({
    routeTree: root.addChildren([noticesRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <UIProvider theme={theme} config={config}>
      <QueryClientAtomProvider client={client}>
        <Hydrate repository={repository}>
          <RouterProvider router={router} />
        </Hydrate>
      </QueryClientAtomProvider>
    </UIProvider>,
  );
  return router;
}

test("opening /notices reads every notice on it, keeping when one was read first", async () => {
  const first = { id: "notice-2026-10-01", updatedAt: "2026-10-02T00:00:00.000Z" };
  const repository = createMemoryRepository({ noticeReads: [first] });
  const notices = [notice("2026-10-01", "読んだ"), notice("2026-10-05", "まだ")];
  await renderAt("/notices", notices, repository);

  await expect
    .poll(async () => (await repository.noticeReads.list()).map((read) => read.id))
    .toEqual(["notice-2026-10-01", "notice-2026-10-05"]);
  expect((await repository.noticeReads.list())[0]).toEqual(first);
});

test("/notices shows every notice in full, newest first, and the recent articles beside", async () => {
  await renderAt(
    "/notices",
    ["2026-10-01", "2026-10-05", "2026-10-02", "2026-10-04", "2026-10-03"].map((date) =>
      notice(date, `お知らせ ${date}`),
    ),
  );

  const titles = page.getByRole("main").getByRole("heading", { level: 2 });
  await expectTexts(titles, [
    "お知らせ 2026-10-05",
    "お知らせ 2026-10-04",
    "お知らせ 2026-10-03",
    "お知らせ 2026-10-02",
    "お知らせ 2026-10-01",
  ]);
  const oldest = page.getByRole("article").last();
  await expect.element(oldest).toHaveAttribute("id", "notice-2026-10-01");
  await expect.element(oldest.getByText("お知らせ 2026-10-01の本文です。")).toBeVisible();
  await expect.element(oldest.getByText("2段落目です。")).toBeVisible();
  // At a phone's width the sidebar is in the header's menu, hidden here.
  const sidebar = page.getByRole("complementary", { name: "サイドバー", includeHidden: true });
  await expect
    .element(sidebar.getByRole("link", { name: "買う順番", includeHidden: true }))
    .toHaveAttribute("href", "/guides/buying-order");
});

test("/notices says so when there is no notice", async () => {
  await renderAt("/notices", []);
  await expect.element(page.getByRole("main").getByText("お知らせはありません。")).toBeVisible();
});
