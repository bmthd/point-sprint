import { type OfficialEvent, officialEvents } from "@workspaces/domain";
import { Badge, Flex, Button, Card, Heading, Text, VStack } from "@workspaces/ui";
import { monthDayWithWeekday } from "../../../ui/dates";

/** The most a shop-around benefit adds, and the cap on what it pays. */
function shopAroundSummary(event: OfficialEvent): string {
  const benefit = event.benefits.find((candidate) => candidate.kind === "shop-around");
  if (benefit?.kind !== "shop-around") return "";
  const { tiers, cap } = benefit.params;
  const maxRate = Math.max(...tiers.map((tier) => tier.rate));
  const capText = cap === undefined ? "" : `・上限 ${cap.toLocaleString("ja-JP")}P`;
  return `・買いまわり最大 +${maxRate}倍${capText}`;
}

type EventCardProps = {
  event: OfficialEvent;
  /** `undefined` before the date is known: the card then has no status badge. */
  status: "active" | "upcoming" | undefined;
  disabled: boolean;
  onCreate: (event: OfficialEvent) => void;
};

function EventCard({ event, status, disabled, onCreate }: EventCardProps) {
  return (
    <Card.Root as="li">
      <Card.Body>
        <Flex align="center" gap="2">
          {status ? (
            <Badge
              colorScheme={status === "active" ? "primary" : "mono"}
              variant={status === "active" ? "solid" : "outline"}
            >
              {status === "active" ? "開催中" : "開催予定"}
            </Badge>
          ) : null}
          <Text fontSize="md" fontWeight="bold">
            {event.name}
          </Text>
        </Flex>
        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
          {monthDayWithWeekday(event.period.start)} 〜 {monthDayWithWeekday(event.period.end)}
          {shopAroundSummary(event)}
        </Text>
        <Button colorScheme="primary" size="lg" disabled={disabled} onClick={() => onCreate(event)}>
          このイベントでプランを作る
        </Button>
      </Card.Body>
    </Card.Root>
  );
}

type EventSectionProps = {
  /** Today in Japan as `YYYY-MM-DD`, the day of the build in the HTML rendered ahead of time. */
  today: string | undefined;
  disabled: boolean;
  onCreate: (event: OfficialEvent) => void;
  onCreateWithoutEvent: () => void;
};

/** Official events carry no device data, so this section is part of the HTML rendered at build time. */
export function EventSection({
  today,
  disabled,
  onCreate,
  onCreateWithoutEvent,
}: EventSectionProps) {
  const events = today
    ? officialEvents.filter((event) => event.period.end >= today)
    : officialEvents;
  return (
    <VStack as="section" gap="2.5" alignItems="stretch">
      <Heading as="h2" fontSize="md">
        開催中・開催予定のイベント
      </Heading>
      <VStack as="ul" listStyle="none" m="0" p="0" gap="2.5" alignItems="stretch">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            status={today ? (event.period.start <= today ? "active" : "upcoming") : undefined}
            disabled={disabled}
            onCreate={onCreate}
          />
        ))}
      </VStack>
      <Button
        variant="ghost"
        colorScheme="link"
        size="lg"
        alignSelf="flex-start"
        disabled={disabled}
        onClick={onCreateWithoutEvent}
      >
        イベントを選ばずにプランを作る
      </Button>
    </VStack>
  );
}
