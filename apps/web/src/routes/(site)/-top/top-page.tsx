import { ClientOnly, useHydrated, useNavigate } from "@tanstack/react-router";
import { type OfficialEvent, type Plan, createPlan } from "@workspaces/domain";
import { Box, Button, Flex, Modal, Text } from "@workspaces/ui";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useState, useTransition } from "react";
import { replacePlan, runSavePlanAtom } from "#/state/mutations.ts";
import { plansAtom, plansQueryAtom } from "#/state/queries.ts";
import { ShareSection } from "#/routes/-sidebar/share-section.tsx";
import { monthOf, tokyoToday } from "#/ui/dates.ts";
import { officialEventsQueryAtom } from "#/routes/-official-events.ts";
import { useToday } from "#/routes/-use-today.ts";
import { EventSection } from "./event-section.tsx";
import { Hero, SampleCard } from "./hero.tsx";
import { PlanSection } from "./plan-section.tsx";
import { startTarget } from "./start-target.ts";

/** The button a plan was started from: the hero's, or one in the events. */
type Origin = "hero" | "events";

/** Where the hero's start button goes, by the events read when it is pressed. */
const startTargetAtom = atom(null, (get, _set, today: string | undefined) => {
  const { data, isError } = get(officialEventsQueryAtom);
  // Events kept from before a read that failed are not offered: the list says they cannot be read.
  return startTarget(isError ? undefined : data, today);
});

/**
 * What `now` is overridden by in tests; the default is the real clock. `renderedToday` is the day in
 * Japan the Worker rendered the page for, which the page keeps until it runs.
 */
export function TopPage({
  now = () => new Date(),
  renderedToday,
}: {
  now?: () => Date;
  renderedToday?: string;
}) {
  const navigate = useNavigate();
  const today = useToday(now);
  // The events' statuses start from the day the page was rendered for, so that they do not
  // move as it hydrates, then follow the browser's today, should a page kept from the day before
  // reach it.
  const hydrated = useHydrated();
  const shownToday = hydrated ? today : renderedToday;
  const savePlan = useSetAtom(runSavePlanAtom);
  // The plan being made: the page stays and its button loads until the plan is saved and open.
  const [creating, startCreating] = useTransition();
  const [started, setStarted] = useState<{ event?: OfficialEvent; origin: Origin }>();
  // Where the plan that could not be saved was started, so the error shows next to that button.
  const [failed, setFailed] = useState<Origin>();
  const plans = useAtomValue(plansAtom);
  // A plan is started only once the saved ones have been read: before that the list is empty, and
  // a plan whose name is taken would be made again without asking.
  const { isSuccess: plansLoaded } = useAtomValue(plansQueryAtom);
  const disabled = !hydrated || !plansLoaded || creating;
  const startedFrom = (origin: Origin) =>
    creating && started?.origin === origin ? started : undefined;
  const [duplicate, setDuplicate] = useState<{
    existing: Plan;
    event?: OfficialEvent;
    origin: Origin;
  }>();
  const startTargetOf = useSetAtom(startTargetAtom);

  const start = () => {
    const target = startTargetOf(shownToday);
    if (target.kind === "create") return request(target.event, "hero");
    const section = document.getElementById("events");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    section?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  };

  const nameOf = (event: OfficialEvent | undefined, date: Date) => {
    const month = monthOf(event ? event.period.start : tokyoToday(date));
    return event ? `${month}月 ${event.name}` : `${month}月の買い物`;
  };

  const request = (event: OfficialEvent | undefined, origin: Origin) => {
    const name = nameOf(event, now());
    const existing = plans.find((plan) => plan.name === name);
    if (existing) setDuplicate({ existing, event, origin });
    else create(event, origin);
  };

  const create = (event: OfficialEvent | undefined, origin: Origin) => {
    setStarted({ event, origin });
    setFailed(undefined);
    startCreating(async () => {
      const date = now();
      const id = crypto.randomUUID();
      const name = nameOf(event, date);
      try {
        await savePlan(
          replacePlan(
            createPlan({
              id,
              name,
              event,
              now: date.toISOString(),
              newId: () => crypto.randomUUID(),
            }),
          ),
        );
        await navigate({ to: "/plan", search: { id } });
      } catch {
        setFailed(origin);
      }
    });
  };

  return (
    <Box as="main">
      {/* The first screen: the hero and the events fill the screen under the header, so the footer
          starts just below it. The height is the small viewport's (svh), which stays the same while
          the browser's toolbar slides in and out on a scroll; with dvh it changed on every scroll
          and moved everything under it. */}
      <Flex direction="column" minH="calc(100svh - {sizes.14} - 1px)">
        <Hero
          onStart={start}
          disabled={disabled}
          loading={startedFrom("hero") !== undefined}
          failed={failed === "hero"}
          aside={
            <ClientOnly fallback={<SampleCard />}>
              {plans.length === 0 ? <SampleCard /> : <PlanSection />}
            </ClientOnly>
          }
        />
        <EventSection
          today={shownToday}
          disabled={disabled}
          starting={startedFrom("events")}
          onCreate={(event) => request(event, "events")}
          onCreateWithoutEvent={() => request(undefined, "events")}
          failed={failed === "events"}
        />
      </Flex>
      <Box maxW="1280px" mx="auto" px={{ base: "6", md: "5" }} pb="10">
        <Box maxW="sm" mx="auto">
          <ShareSection />
        </Box>
      </Box>
      <Modal.Root open={duplicate !== undefined} onClose={() => setDuplicate(undefined)}>
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>同じ名前のプランがあります</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Text>「{duplicate?.existing.name}」はすでにあります。</Text>
          </Modal.Body>
          {/* Side by side when they fit; stacked otherwise, with the main one on top. */}
          <Modal.Footer flexWrap="wrap-reverse">
            <Button
              variant="outline"
              size="lg"
              flexGrow="1"
              onClick={() => {
                if (!duplicate) return;
                setDuplicate(undefined);
                create(duplicate.event, duplicate.origin);
              }}
            >
              新しく作る
            </Button>
            <Button
              colorScheme="primary"
              size="lg"
              flexGrow="1"
              onClick={() => {
                if (duplicate)
                  void navigate({ to: "/plan", search: { id: duplicate.existing.id } });
              }}
            >
              既存のプランを開く
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </Box>
  );
}
