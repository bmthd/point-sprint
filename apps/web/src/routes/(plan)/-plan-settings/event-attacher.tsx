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
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { attachToEventAtom } from "#/state/plan-operations.ts";
import { officialEventsAtom } from "#/routes/-official-events.ts";
import { useSaveSettingsChange, whenText } from "./settings-shared.ts";

const periodText = (event: OfficialEvent) => whenText({ type: "range", ...event.period });

/**
 * 「公式イベント」: attaches a plan made without an event to one of the master's events, after
 * saying what the event's period and benefits replace. Shown only on a plan without an event, and
 * once the events have loaded.
 */
export function EventAttacher({ plan }: { plan: Plan }) {
  const events = useAtomValue(officialEventsAtom);
  const attach = useSetAtom(attachToEventAtom);
  const save = useSaveSettingsChange(plan.id);
  const { open, onOpen, onClose } = useDisclosure();
  const [eventId, setEventId] = useState("");
  if (plan.officialEventId !== undefined || events.length === 0) return null;
  const event = events.find((candidate) => candidate.id === eventId);
  const outside = event
    ? plan.orders.filter(
        (order) => order.date < event.period.start || order.date > event.period.end,
      ).length
    : 0;

  return (
    <Card.Root as="section" aria-label="公式イベント">
      <Card.Body alignItems="stretch" gap="3">
        <Field.Root label="公式イベントに結びつける">
          {/* Not `placeholder`, which would name the select in place of its label. */}
          <NativeSelect.Root
            value={eventId}
            onChange={(change) => setEventId(change.currentTarget.value)}
          >
            <option value="">イベントを選ぶ</option>
            {events.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}（{periodText(candidate)}）
              </option>
            ))}
          </NativeSelect.Root>
        </Field.Root>
        <Text fontSize="xs" color="fg.muted">
          イベントの前に作ったプランを、あとから公開されたイベントに結びつけます。期間と特典がイベントのものになります。
        </Text>
        <Button
          variant="outline"
          colorScheme="primary"
          alignSelf="flex-start"
          disabled={!event}
          onClick={onOpen}
        >
          結びつける
        </Button>
      </Card.Body>
      <Modal.Root
        open={open}
        title="公式イベントに結びつけますか？"
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
          </List.Root>
        }
        cancel="キャンセル"
        success={{ children: "結びつける", colorScheme: "primary" }}
        onClose={onClose}
        onCancel={onClose}
        onSuccess={() => {
          if (event) save(attach({ planId: plan.id, event }));
          onClose();
        }}
      />
    </Card.Root>
  );
}
