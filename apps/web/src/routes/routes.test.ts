import { createMemoryHistory } from "@tanstack/react-router";
import * as v from "valibot";
import { expect, test } from "vitest";
import { getRouter } from "../router";
import { PlanSearchSchema } from "./(plan)/-plan-search";
import { Route as planRoute } from "./(plan)/plan";
import { Route as settingsRoute } from "./(plan)/plan_.settings";

test("plan route validates search id", () => {
  expect(planRoute.options.validateSearch).toBe(PlanSearchSchema);
  expect(settingsRoute.options.validateSearch).toBe(PlanSearchSchema);
  expect(v.parse(PlanSearchSchema, { id: "abc" })).toEqual({ id: "abc" });
  expect(v.parse(PlanSearchSchema, {})).toEqual({ id: undefined });
});

test("plan settings is a sibling of the plan route, not its child", () => {
  const router = getRouter();
  const settings = router.routesById["/(plan)/plan_/settings"];
  expect(settings.fullPath).toBe("/plan/settings");
  expect(settings.parentRoute.id).toBe("__root__");
  expect(router.routesByPath["/plan/settings"]).toBe(settingsRoute);
});

// The root's head reads a field the router marks as internal: this fails if it goes away.
test.each(["/no-such-page", "/help/no-such-page", "/plan/no-such-page"])(
  "%s gets the not-found page's title and noindex",
  async (path) => {
    const router = getRouter();
    router.update({ ...router.options, history: createMemoryHistory({ initialEntries: [path] }) });
    await router.load();
    const meta = router.state.matches.flatMap((match) => match.meta ?? []);
    expect(meta.findLast((m) => m?.title)?.title).toBe(
      "ページが見つかりません | ポイントスプリント",
    );
    expect(meta).toContainEqual({ name: "robots", content: "noindex" });
  },
);

test("a page that exists is not marked as not found", async () => {
  const router = getRouter();
  router.update({ ...router.options, history: createMemoryHistory({ initialEntries: ["/help"] }) });
  await router.load();
  const meta = router.state.matches.flatMap((match) => match.meta ?? []);
  expect(meta.findLast((m) => m?.title)?.title).toBe("使い方・注意事項 | ポイントスプリント");
});
