import { expect, test } from "vitest";
import { getRouter } from "./router";
import { missingPrerenderedPages, prerenderedPages } from "./prerender-pages";

test("every route is prerendered", () => {
  const routePaths = Object.keys(getRouter().routesByPath).map((path) =>
    path.length > 1 ? path.replace(/\/$/, "") : path,
  );
  expect(prerenderedPages.map((page) => page.path).toSorted()).toEqual(
    [...new Set(routePaths)].toSorted(),
  );
});

test("lists the pages whose HTML file is missing", () => {
  const built = new Set(["index.html", "plan/index.html", "profile/index.html"]);
  expect(missingPrerenderedPages((file) => built.has(file))).toEqual(["plan/settings/index.html"]);
});
