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
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { expectTexts } from "../../../test-texts";
import { NoticeHeadlines } from "../../-notices/notice-headlines";
import type { Notice } from "../../-notices/notices";
import { NoticesPage } from "./notices-page";

const notice = (date: string, title: string): Notice => ({
  id: `notice-${date}`,
  date,
  title,
  body: `${title}の本文です。\n\n2段落目です。`,
});

/** `/` has the headlines alone, `/notices` the page, in a router with a memory history. */
async function renderAt(path: string, notices: Notice[]) {
  await cleanup();
  const root = createRootRoute({ component: Outlet });
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
  await render(
    <UIProvider theme={theme} config={config}>
      <RouterProvider router={router} />
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

test("/notices shows every notice in full, newest first, without the headlines", async () => {
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
  await expect.element(sidebar).toBeInTheDocument();
  await expect.element(sidebar).not.toMatchTextContent("お知らせ");
});

test("/notices says so when there is no notice", async () => {
  await renderAt("/notices", []);
  await expect.element(page.getByRole("main").getByText("お知らせはありません。")).toBeVisible();
});
