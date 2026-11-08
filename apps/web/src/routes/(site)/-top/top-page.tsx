import { ClientOnly, useHydrated, useNavigate } from "@tanstack/react-router";
import { type OfficialEvent, type Plan, createPlan } from "@workspaces/domain";
import { Box, Button, Flex, Modal, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { replacePlan, savePlanAtom } from "#/state/mutations.ts";
import { plansAtom } from "#/state/queries.ts";
import { useSingleFlight } from "#/use-single-flight.ts";
import { ShareSection } from "#/routes/-sidebar/share-section.tsx";
import { monthOf, tokyoToday } from "#/ui/dates.ts";
import { officialEventsQueryAtom } from "#/routes/-official-events.ts";
import { useToday } from "#/routes/-use-today.ts";
import { EventSection } from "./event-section";
import { Hero, SampleCard } from "./hero";
import { PlanSection } from "./plan-section";
import { startTarget } from "./start-target";

/** The button a plan was started from: the hero's, or one in the events. */
type Origin = "hero" | "events";

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
  const { mutateAsync: savePlan } = useAtomValue(savePlanAtom);
  const [creating, setCreating] = useState(false);
  // Where the plan that could not be saved was started, so the error shows next to that button.
  const [failed, setFailed] = useState<Origin>();
  const plans = useAtomValue(plansAtom);
  const [duplicate, setDuplicate] = useState<{
    existing: Plan;
    event?: OfficialEvent;
    origin: Origin;
  }>();
  const run = useSingleFlight();
  const { data, isError } = useAtomValue(officialEventsQueryAtom);
  // Events kept from before a read that failed are not offered: the list says they cannot be read.
  const events = isError ? undefined : data;

  const start = () => {
    const target = startTarget(events, shownToday);
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
    else void create(event, origin);
  };

  const create = (event: OfficialEvent | undefined, origin: Origin) =>
    run(async () => {
      setCreating(true);
      setFailed(undefined);
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
      } finally {
        setCreating(false);
      }
    });

  return (
    <Box as="main">
      {/* The first screen: the hero and the events fill the screen under the header, so the footer
          starts just below it. The height is the small viewport's (svh), which stays the same while
          the browser's toolbar slides in and out on a scroll; with dvh it changed on every scroll
          and moved everything under it. */}
      <Flex direction="column" minH="calc(100svh - {sizes.14} - 1px)">
        <Hero
          onStart={start}
          disabled={!hydrated || creating}
          failed={failed === "hero"}
          aside={
            <ClientOnly fallback={<SampleCard />}>
              {plans.length === 0 ? <SampleCard /> : <PlanSection />}
            </ClientOnly>
          }
        />
        <EventSection
          today={shownToday}
          disabled={!hydrated || creating}
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
                void create(duplicate.event, duplicate.origin);
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
