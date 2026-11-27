import type { OfficialEvent, Plan } from "@workspaces/domain";
import {
  Button,
  Card,
  Field,
  List,
  Modal,
  NativeSelect,
  Text,
  useDisclosure,
} from "@workspaces/ui";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { attachToEventAtom, carryOverToEventAtom } from "#/state/plan-operations.ts";
import { officialEventsAtom } from "#/routes/-official-events.ts";
import { useToday } from "#/routes/-use-today.ts";
import { useSaveSettingsChange, whenText } from "./settings-shared.ts";

const periodText = (event: OfficialEvent) => whenText({ type: "range", ...event.period });

const now = () => new Date();

/**
 * Set to bring 「公式イベント」 into view the next time it shows: the plan's 「別のイベントに引き継ぐ」
 * opens the settings with it. It waits for the events to load, and is cleared once shown.
 */
export const eventAttacherRequestAtom = atom(false);

/**
 * 「公式イベント」: attaches a plan made without an event to one of the master's events, or carries a
 * plan of an event over to another one that has not ended, after saying what the event's period and
 * benefits replace. Carrying over also releases the plan's hold. Shown once the events have loaded.
 */
export function EventAttacher({ plan }: { plan: Plan }) {
  const events = useAtomValue(officialEventsAtom);
  const attach = useSetAtom(attachToEventAtom);
  const carryOver = useSetAtom(carryOverToEventAtom);
  const save = useSaveSettingsChange(plan.id);
  const today = useToday(now);
  const { open, onOpen, onClose } = useDisclosure();
  const [eventId, setEventId] = useState("");
  const [requested, setRequested] = useAtom(eventAttacherRequestAtom);
  const section = useRef<HTMLElement>(null);
  const shown = events.length > 0;
  useEffect(() => {
    if (!requested || !shown) return;
    section.current?.scrollIntoView({ block: "center" });
    setRequested(false);
  }, [requested, shown, setRequested]);
  if (!shown) return null;

  const carrying = plan.officialEventId !== undefined;
  const candidates = carrying
    ? events.filter(
        (candidate) =>
          candidate.id !== plan.officialEventId &&
          (today === undefined || candidate.period.end >= today),
      )
    : events;
  const event = candidates.find((candidate) => candidate.id === eventId);
  const outside = event
    ? plan.orders.filter(
        (order) => order.date < event.period.start || order.date > event.period.end,
      ).length
    : 0;
  const action = carrying ? "引き継ぐ" : "結びつける";

  return (
    <Card.Root as="section" ref={section} aria-label="公式イベント">
      <Card.Body alignItems="stretch" gap="3">
        {candidates.length === 0 ? (
          <>
            <Text fontWeight="bold">別のイベントに引き継ぐ</Text>
            <Text fontSize="sm" color="fg.muted">
              引き継げるイベントはまだありません。次のイベントが公開されたら、ここで選べます。
            </Text>
          </>
        ) : (
          <>
            <Field.Root label={carrying ? "別のイベントに引き継ぐ" : "公式イベントに結びつける"}>
              {/* Not `placeholder`, which would name the select in place of its label. */}
              <NativeSelect.Root
                value={eventId}
                onChange={(change) => setEventId(change.currentTarget.value)}
              >
                <option value="">イベントを選ぶ</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}（{periodText(candidate)}）
                  </option>
                ))}
              </NativeSelect.Root>
            </Field.Root>
            <Text fontSize="xs" color="fg.muted">
              {carrying
                ? "注文を残したまま、プランを別のイベントに移します。期間と特典がイベントのものになります。"
                : "イベントの前に作ったプランを、あとから公開されたイベントに結びつけます。期間と特典がイベントのものになります。"}
            </Text>
            <Button
              variant="outline"
              colorScheme="primary"
              alignSelf="flex-start"
              disabled={!event}
              onClick={onOpen}
            >
              {action}
            </Button>
          </>
        )}
      </Card.Body>
      <Modal.Root
        open={open}
        title={carrying ? "別のイベントに引き継ぎますか？" : "公式イベントに結びつけますか？"}
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
            {carrying && plan.onHold ? (
              <List.Item>プランの保留を解き、ほかのプランと合わせて計算します。</List.Item>
            ) : null}
          </List.Root>
        }
        cancel="キャンセル"
        success={{ children: action, colorScheme: "primary" }}
        onClose={onClose}
        onCancel={onClose}
        onSuccess={() => {
          if (event) {
            save(
              carrying ? carryOver({ planId: plan.id, event }) : attach({ planId: plan.id, event }),
            );
            setEventId("");
          }
          onClose();
        }}
      />
    </Card.Root>
  );
}
