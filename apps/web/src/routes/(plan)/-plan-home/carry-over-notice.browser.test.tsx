import type { Plan } from "@workspaces/domain";
import { beforeEach, expect, onTestFinished, test, vi } from "vitest";
import { page } from "vitest/browser";
import { createMemoryRepository } from "#/storage/memory-repository.ts";
import {
  makePlan,
  marathon,
  order,
  renderPlanHome,
  shops,
} from "#/routes/(plan)/-test-fixtures.tsx";

beforeEach(async () => {
  await page.viewport(390, 844);
  vi.useFakeTimers({ toFake: ["Date"] });
  // After the plan's event (10/4 to 10/9).
  vi.setSystemTime(new Date("2026-11-27T03:00:00Z"));
  onTestFinished(() => {
    vi.useRealTimers();
  });
});

const planOfEvent = (change: Partial<Plan> = {}): Plan => ({
  ...makePlan(structuredClone(marathon), [order(0)]),
  officialEventId: "marathon-2026-10",
  ...change,
});

const render = (plan: Plan) => renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));

const carryOver = () => page.getByRole("button", { name: "別のイベントに引き継ぐ" });

test("a held plan of an ended event offers to carry it over, and opens the settings for it", async () => {
  const screen = await render(planOfEvent({ onHold: true }));
  await expect
    .element(page.getByRole("status").filter({ hasText: "このイベントは終わりました" }))
    .toBeVisible();
  await carryOver().click();
  await expect.poll(() => screen.router.state.location.pathname).toBe("/plan/settings");
  expect(screen.router.state.location.search).toEqual({ id: planOfEvent().id });
});

test("a plan that is not held, or whose event has not ended, is not offered to be carried over", async () => {
  await render(planOfEvent());
  await expect.element(page.getByRole("heading", { name: planOfEvent().name })).toBeVisible();
  await expect.element(carryOver()).not.toBeInTheDocument();

  await render(planOfEvent({ onHold: true, period: { start: "2026-11-20", end: "2026-11-27" } }));
  await expect.element(page.getByRole("heading", { name: planOfEvent().name })).toBeVisible();
  await expect.element(carryOver()).not.toBeInTheDocument();
});
