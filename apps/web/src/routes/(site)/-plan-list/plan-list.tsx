import { ClientOnly, useNavigate } from "@tanstack/react-router";
import { type OfficialEvent, type Plan, createPlan } from "@workspaces/domain";
import { Button, Heading, Modal, Text, VStack } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useCallback, useState, useSyncExternalStore } from "react";
import { replacePlan, savePlanAtom } from "../../../state/mutations";
import { plansAtom, profileAtom, profileQueryAtom } from "../../../state/queries";
import { useLatestRef } from "../../../use-latest-ref";
import { useSingleFlight } from "../../../use-single-flight";
import { PageWithSidebar } from "../-sidebar/sidebar";
import { monthOf, msUntilTokyoMidnight, tokyoToday } from "../../../ui/dates";
import { EventSection } from "./event-section";
import { PlanSection } from "./plan-section";

/** Today in Japan on the client, `undefined` in the HTML rendered ahead of time. */
export function useToday(now: () => Date): string | undefined {
  // `subscribe` reads `now` through a ref so a new function on each render does not subscribe again.
  const nowRef = useLatestRef(now);
  const subscribe = useCallback(
    (onChange: () => void) => {
      let timer: ReturnType<typeof setTimeout>;
      // Wakes up at each midnight in Japan, so the date changes while the page stays open.
      const schedule = () => {
        timer = setTimeout(() => {
          onChange();
          schedule();
        }, msUntilTokyoMidnight(nowRef.current()));
      };
      schedule();
      return () => clearTimeout(timer);
    },
    [nowRef],
  );
  return useSyncExternalStore(
    subscribe,
    () => tokyoToday(now()),
    () => undefined,
  );
}

/** What `now` is overridden by in tests; the default is the real clock. */
export function PlanList({ now = () => new Date() }: { now?: () => Date }) {
  const navigate = useNavigate();
  const today = useToday(now);
  const profile = useAtomValue(profileAtom);
  const { isSuccess: profileLoaded } = useAtomValue(profileQueryAtom);
  const { mutateAsync: savePlan } = useAtomValue(savePlanAtom);
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const plans = useAtomValue(plansAtom);
  const [duplicate, setDuplicate] = useState<{ existing: Plan; event?: OfficialEvent }>();
  const run = useSingleFlight();

  const nameOf = (event: OfficialEvent | undefined, date: Date) => {
    const month = monthOf(event ? event.period.start : tokyoToday(date));
    return event ? `${month}月 ${event.name}` : `${month}月の買い物`;
  };

  const request = (event?: OfficialEvent) => {
    const name = nameOf(event, now());
    const existing = plans.find((plan) => plan.name === name);
    if (existing) setDuplicate({ existing, event });
    else void create(event);
  };

  const create = (event?: OfficialEvent) =>
    run(async () => {
      setCreating(true);
      setFailed(false);
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
              profile,
              now: date.toISOString(),
              newId: () => crypto.randomUUID(),
            }),
          ),
        );
        await navigate({ to: "/plan", search: { id } });
      } catch {
        setFailed(true);
      } finally {
        setCreating(false);
      }
    });

  return (
    <PageWithSidebar maxW="768px">
      <VStack alignItems="stretch" gap="6">
        <EventSection
          today={today}
          disabled={!profileLoaded || creating}
          onCreate={request}
          onCreateWithoutEvent={() => request()}
        />
        {failed ? (
          <Text role="alert" fontSize="sm" color="danger.fg">
            プランを作れませんでした。もう一度お試しください。
          </Text>
        ) : null}
        <ClientOnly
          fallback={
            <Heading as="h2" fontSize="md">
              プラン
            </Heading>
          }
        >
          <PlanSection />
        </ClientOnly>
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
                  const event = duplicate?.event;
                  setDuplicate(undefined);
                  void create(event);
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
      </VStack>
    </PageWithSidebar>
  );
}
