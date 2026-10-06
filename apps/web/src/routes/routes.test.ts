import * as v from "valibot";
import { expect, test } from "vitest";
import { getRouter } from "../router";
import { planSearchSchema } from "../planSearch";
import { Route as planRoute } from "./plan";
import { Route as settingsRoute } from "./plan_.settings";

test("plan route validates search id", () => {
  expect(planRoute.options.validateSearch).toBe(planSearchSchema);
  expect(settingsRoute.options.validateSearch).toBe(planSearchSchema);
  expect(v.parse(planSearchSchema, { id: "abc" })).toEqual({ id: "abc" });
  expect(v.parse(planSearchSchema, {})).toEqual({ id: undefined });
});

test("plan settings is a sibling of the plan route, not its child", () => {
  const router = getRouter();
  const settings = router.routesById["/plan_/settings"];
  expect(settings.fullPath).toBe("/plan/settings");
  expect(settings.parentRoute.id).toBe("__root__");
  expect(router.routesByPath["/plan/settings"]).toBe(settingsRoute);
});
