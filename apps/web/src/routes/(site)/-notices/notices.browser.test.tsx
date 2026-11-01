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
import type { RecentArticle } from "../../../guides/recent-articles";
import { repositoryAtom } from "../../../state/repository";
import { createMemoryRepository } from "../../../storage/memory-repository";
import type { Repository } from "../../../storage/repository";
import { expectTexts } from "../../../test-texts";
import type { Notice } from "../../-notices/notices";
import { NoticeHeadlines } from "../-top/notice-headlines";
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

/** `/` has the headlines alone, `/notices` the page, in a router with a memory history. */
async function renderAt(
  path: string,
  notices: Notice[],
  repository: Repository = createMemoryRepository(),
) {
  await cleanup();
  const root = createRootRoute({ component: Outlet, loader: () => ({ recentArticles }) });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <NoticeHeadlines notices={notices} />,
  });
  const noticesRoute = createRoute({
    getParentRoute: () => root,
    path: "/notices",
    component: () => <NoticesPage notices={notices} />,
  });
  const router = createRouter({
    routeTree: root.addChildren([index, noticesRoute]),
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

const headlines = () => page.getByRole("region", { name: "お知らせ" });

test("the headlines are the latest three, newest first, each a link to its notice", async () => {
  const router = await renderAt(
    "/",
    ["2026-10-01", "2026-10-05", "2026-10-02", "2026-10-04", "2026-10-03"].map((date) =>
      notice(date, `お知らせ ${date}`),
    ),
  );

  const links = headlines().getByRole("listitem").getByRole("link");
  await expectTexts(links, ["お知らせ 2026-10-05", "お知らせ 2026-10-04", "お知らせ 2026-10-03"]);
  await expect.element(links.first()).toHaveAttribute("href", "/notices#notice-2026-10-05");
  await expect.element(headlines().getByText("本文", { exact: false })).not.toBeInTheDocument();
  const time = headlines().getByRole("time").first();
  await expect.element(time).toHaveTextContent("2026年10月5日");
  await expect.element(time).toHaveAttribute("datetime", "2026-10-05");

  await headlines().getByRole("link", { name: "すべてのお知らせ" }).click();
  await expect.poll(() => router.state.location.pathname).toBe("/notices");
});

test("the headlines say so when there is no notice", async () => {
  await renderAt("/", []);
  await expect.element(headlines().getByText("お知らせはありません。")).toBeVisible();
  await expect.element(headlines().getByRole("link")).not.toBeInTheDocument();
});

test("the headlines tell the notices not read yet", async () => {
  const repository = createMemoryRepository({
    noticeReads: [{ id: "notice-2026-10-01", updatedAt: "2026-10-02T00:00:00.000Z" }],
  });
  await renderAt("/", [notice("2026-10-01", "読んだ"), notice("2026-10-05", "まだ")], repository);

  await expect.element(headlines().getByRole("link", { name: "まだ（未読）" })).toBeVisible();
  await expect
    .element(headlines().getByRole("link", { name: "読んだ", exact: true }))
    .toBeVisible();
});

test("opening /notices reads every notice on it, keeping when one was read first", async () => {
  const first = { id: "notice-2026-10-01", updatedAt: "2026-10-02T00:00:00.000Z" };
  const repository = createMemoryRepository({ noticeReads: [first] });
  const notices = [notice("2026-10-01", "読んだ"), notice("2026-10-05", "まだ")];
  await renderAt("/notices", notices, repository);

  await expect
    .poll(async () => (await repository.noticeReads.list()).map((read) => read.id))
    .toEqual(["notice-2026-10-01", "notice-2026-10-05"]);
  expect((await repository.noticeReads.list())[0]).toEqual(first);

  await renderAt("/", notices, repository);
  await expect.element(headlines().getByRole("link", { name: "まだ", exact: true })).toBeVisible();
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
