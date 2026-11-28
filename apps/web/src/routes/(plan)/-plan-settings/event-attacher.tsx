import { type Benefit, eventPlanPeriod, type OfficialEvent, type Plan } from "@workspaces/domain";
import { Button, Card, Field, List, Modal, NativeSelect, Text } from "@workspaces/ui";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { type RefObject, useEffect, useState } from "react";
import { planAtom } from "#/state/derived.ts";
import { attachToEventAtom, carryOverToEventAtom } from "#/state/plan-operations.ts";
import { officialEventsAtom } from "#/routes/-official-events.ts";
import { useToday } from "#/routes/-use-today.ts";
import { isAddedCampaign } from "./campaign-toggles.tsx";
import { useSaveSettingsChange, whenText } from "./settings-shared.ts";

const periodText = (event: OfficialEvent) => whenText({ type: "range", ...eventPlanPeriod(event) });

const now = () => new Date();

/**
 * Set to open the card of the plan's event, where it is carried over to another event, the next
 * time the settings show: the plan's 「別のイベントに引き継ぐ」 opens the settings with it.
 */
export const eventChangeRequestAtom = atom(false);

/** Whether `benefit` came with the plan's event, so that its card is where the event is changed. */
export function isEventBenefit(plan: Pick<Plan, "officialEventId">, benefit: Benefit) {
  return plan.officialEventId !== undefined && !isAddedCampaign(plan, benefit);
}

/**
 * Opens the card of the plan's event and brings it into view when `eventChangeRequestAtom` asks
 * for it. `enabled` on that one card only: the first that sees the request clears it.
 */
export function useEventChangeRequest(
  enabled: boolean,
  open: () => void,
  section: RefObject<HTMLElement | null>,
) {
  const [requested, setRequested] = useAtom(eventChangeRequestAtom);
  useEffect(() => {
    if (!requested || !enabled) return;
    setRequested(false);
    open();
    // Once the card has opened, so that its fields are in view too.
    requestAnimationFrame(() => section.current?.scrollIntoView({ block: "start" }));
  }, [requested, enabled, open, section, setRequested]);
}

/**
 * 「公式イベント」: attaches a plan made without an event to one of the master's events, after
 * saying what the event's period and benefits replace. Shown only on a plan without an event, and
 * once the events have loaded. A plan of an event changes it in its event's card (`EventCarryOver`).
 */
export function EventAttacher({ planId }: { planId: string }) {
  const plan = useAtomValue(planAtom(planId));
  const events = useAtomValue(officialEventsAtom);
  const attach = useSetAtom(attachToEventAtom);
  const save = useSaveSettingsChange(planId);
  if (!plan || plan.officialEventId !== undefined || events.length === 0) return null;
  return (
    <Card.Root as="section" aria-label="公式イベント">
      <Card.Body alignItems="stretch" gap="3">
        <EventPicker
          plan={plan}
          events={events}
          label="公式イベントに結びつける"
          note="イベントの前に作ったプランを、あとから公開されたイベントに結びつけます。期間と特典がイベントのものになります。"
          action="結びつける"
          title="公式イベントに結びつけますか？"
          onChoose={(event) => save(attach({ planId: plan.id, event }))}
        />
      </Card.Body>
    </Card.Root>
  );
}

/**
 * 「イベント」 at the top of the opened card of the plan's event: carries the plan over to another
 * event that has not ended, which also releases its hold. Says so when there is none yet.
 */
export function EventCarryOver({ planId }: { planId: string }) {
  const plan = useAtomValue(planAtom(planId));
  const events = useAtomValue(officialEventsAtom);
  const carryOver = useSetAtom(carryOverToEventAtom);
  const save = useSaveSettingsChange(planId);
  const today = useToday(now);
  if (!plan || events.length === 0) return null;
  const candidates = events.filter(
    (candidate) =>
      candidate.id !== plan.officialEventId &&
      (today === undefined || candidate.period.end >= today),
  );
  if (candidates.length === 0) {
    return (
      <Field.Root label="イベント">
        <Text fontSize="sm" color="fg.muted">
          引き継げるイベントはまだありません。次のイベントが公開されたら、ここで選べます。
        </Text>
      </Field.Root>
    );
  }
  return (
    <EventPicker
      plan={plan}
      events={candidates}
      label="イベント"
      placeholder="別のイベントを選ぶ"
      note="注文を残したまま、プランを別のイベントに引き継ぎます。期間と特典がイベントのものになります。"
      action="引き継ぐ"
      title="別のイベントに引き継ぎますか？"
      releasesHold={plan.onHold === true}
      onChoose={(event) => save(carryOver({ planId: plan.id, event }))}
    />
  );
}

/** Picks one of `events`, and `onChoose` it after saying what the event's period and benefits replace. */
function EventPicker({
  plan,
  events,
  label,
  placeholder = "イベントを選ぶ",
  note,
  action,
  title,
  releasesHold = false,
  onChoose,
}: {
  plan: Plan;
  events: OfficialEvent[];
  label: string;
  placeholder?: string;
  note: string;
  action: string;
  title: string;
  releasesHold?: boolean;
  onChoose: (event: OfficialEvent) => void;
}) {
  const [eventId, setEventId] = useState("");
  const event = events.find((candidate) => candidate.id === eventId);
  const period = event ? eventPlanPeriod(event) : undefined;
  const outside = period
    ? plan.orders.filter((order) => order.date < period.start || order.date > period.end).length
    : 0;
  return (
    <>
      <Field.Root label={label}>
        {/* Not `placeholder`, which would name the select in place of its label. */}
        <NativeSelect.Root
          value={eventId}
          onChange={(change) => setEventId(change.currentTarget.value)}
        >
          <option value="">{placeholder}</option>
          {events.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}（{periodText(candidate)}）
            </option>
          ))}
        </NativeSelect.Root>
      </Field.Root>
      <Text fontSize="xs" color="fg.muted">
        {note}
      </Text>
      <Modal.Root
        title={title}
        body={
          <List.Root styleType="disc" gap="1">
            <List.Item>
              期間を「{event?.name}」の {event ? periodText(event) : ""} にします。
            </List.Item>
            <List.Item>
              特典をイベントのものに置き換えます。手で直した期間と上限、追加したキャンペーンは消えます。
            </List.Item>
            <List.Item>5と0のつく日などは、エントリーの状態ごと残ります。</List.Item>
            {outside > 0 ? (
              <List.Item>
                期間の外になる注文が {outside}{" "}
                件あります。注文は残り、期間の外の注文として扱います。
              </List.Item>
            ) : null}
            {releasesHold ? (
              <List.Item>プランの保留を解き、ほかのプランと合わせて計算します。</List.Item>
            ) : null}
          </List.Root>
        }
        cancel="キャンセル"
        success={{ children: action, colorScheme: "primary" }}
        onSuccess={(onClose) => {
          if (event) {
            onChoose(event);
            setEventId("");
          }
          onClose();
        }}
      >
        <Modal.OpenTrigger>
          <Button variant="outline" colorScheme="primary" alignSelf="flex-start" disabled={!event}>
            {action}
          </Button>
        </Modal.OpenTrigger>
      </Modal.Root>
    </>
  );
}
