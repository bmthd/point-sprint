import { type OfficialEvent, type Plan, startEventChoice } from "@workspaces/domain";
import { monthOf } from "#/ui/dates.ts";

/**
 * Where the hero's start button goes: a new plan for `event`, which may have `ended`; the plan
 * already made for that event; or the events, with the ones to `choose` between.
 */
export type StartTarget =
  | { kind: "create"; event: OfficialEvent; ended: boolean }
  | { kind: "resume"; plan: Plan }
  | { kind: "choose"; events: OfficialEvent[] };

/** The name a plan for `event` gets, as 「10月 お買い物マラソン」. */
export function eventPlanName(event: OfficialEvent): string {
  return `${monthOf(event.period.start)}月 ${event.name}`;
}

/**
 * Translate the event selection into the hero button's action. Missing data leads to the events
 * with none to choose between; a plan whose name the new one would take is opened instead.
 */
export function startTarget(
  events: OfficialEvent[] | undefined,
  today: string | undefined,
  plans: Plan[],
): StartTarget {
  if (events === undefined || today === undefined) return { kind: "choose", events: [] };
  const choice = startEventChoice(events, today);
  if (choice.kind === "none") return { kind: "choose", events: [] };
  if (choice.kind === "many") return { kind: "choose", events: choice.events };
  const name = eventPlanName(choice.event);
  const existing = plans.find((plan) => plan.name === name);
  return existing
    ? { kind: "resume", plan: existing }
    : { kind: "create", event: choice.event, ended: choice.ended };
}

/** The hero button's words for where it goes. */
export function startLabel(target: StartTarget): string {
  switch (target.kind) {
    case "create":
      return target.ended ? "前回の条件で計算" : "計算をはじめる";
    case "resume":
      return "続きを計算する";
    case "choose":
      return target.events.length > 0 ? "イベントを選んで計算" : "計算をはじめる";
  }
}
