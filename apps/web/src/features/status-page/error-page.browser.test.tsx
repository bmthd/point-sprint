import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { ErrorPage } from "./error-page";

test("shows the error page without the error, and reloads the page", async () => {
  let fail = true;
  const root = createRootRoute({ errorComponent: ErrorPage });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => {
      if (fail) throw new Error("秘密の詳細");
      return <p>読み込めた</p>;
    },
  });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <RouterProvider router={router} />
    </UIProvider>,
  );

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "エラーが発生しました" }))
    .toBeVisible();
  await expect
    .element(screen.getByText("入力したデータはこのブラウザに残っています", { exact: false }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("link", { name: "トップに戻る" }))
    .toHaveAttribute("href", "/");
  expect(document.body.textContent).not.toContain("秘密の詳細");

  fail = false;
  await screen.getByRole("button", { name: "再読み込み" }).click();
  await expect.element(screen.getByText("読み込めた")).toBeVisible();
});
