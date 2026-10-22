import { ClientOnly } from "@tanstack/react-router";
import type { OfficialEvent } from "@workspaces/domain";
import {
  Badge,
  Button,
  CalendarXIcon,
  Card,
  Flex,
  Heading,
  Link,
  List,
  Skeleton,
  Text,
  TriangleAlertIcon,
  VStack,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { monthDayWithWeekday } from "../../../ui/dates";
import { officialEventsQueryAtom } from "../../-official-events";
import { ColumnHead } from "../../../ui/column-head";
import { ExternalIcon } from "../../../ui/icons";

/**
 * The highest rate and the cap of each shop-around and spend-tiers benefit,
 * e.g. 「・買いまわり最大 +9倍・上限 7,000P」 or 「・合計額で最大 +4倍・上限 4,000P」.
 */
function tiersSummary(event: OfficialEvent): string {
  return event.benefits
    .map((benefit) => {
      if (benefit.kind !== "shop-around" && benefit.kind !== "spend-tiers") return "";
      const { tiers, cap } = benefit.params;
      const maxRate = Math.max(...tiers.map((tier) => tier.rate));
      // A round is listed from the schedule page before its own page tells the cap.
      const capText =
        cap === undefined ? "・上限は未発表" : `・上限 ${cap.toLocaleString("ja-JP")}P`;
      const what = benefit.kind === "shop-around" ? "買いまわり" : "合計額で";
      return `・${what}最大 +${maxRate}倍${capText}`;
    })
    .join("");
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
    <List.Item>
      <Card.Root>
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
            {tiersSummary(event)}
          </Text>
          {event.url ? (
            <Link
              href={event.url}
              color="link"
              fontSize="sm"
              target="_blank"
              rel="noreferrer"
              alignSelf="flex-start"
              gap="1.5"
            >
              楽天の公式ページ
              <ExternalIcon />
            </Link>
          ) : null}
          <Button
            colorScheme="primary"
            size="lg"
            disabled={disabled}
            onClick={() => onCreate(event)}
          >
            このイベントでプランを作る
          </Button>
        </Card.Body>
      </Card.Root>
    </List.Item>
  );
}

type EventListProps = {
  /** Today in Japan as `YYYY-MM-DD`; `undefined` where nothing sets it, as in some tests. */
  today: string | undefined;
  disabled: boolean;
  onCreate: (event: OfficialEvent) => void;
};

/**
 * What takes the list's place when there is no list, set as an event's card is: the line in bold,
 * what to do under it, and the button.
 */
function EventListNotice({
  icon,
  title,
  description,
  action,
  tone,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "danger";
}) {
  return (
    <Card.Root role={tone === "danger" ? "alert" : undefined}>
      <Card.Body>
        <Flex align="center" gap="2" color={tone === "danger" ? "danger.fg" : undefined}>
          {icon}
          <Text fontSize="md" fontWeight="bold">
            {title}
          </Text>
        </Flex>
        <Text fontSize="sm" color="fg.muted">
          {description}
        </Text>
        {action}
      </Card.Body>
    </Card.Root>
  );
}

/** The events that have not ended, read from the Worker once the page runs. */
function EventList({ today, disabled, onCreate }: EventListProps) {
  const { data, isPending, isError, refetch } = useAtomValue(officialEventsQueryAtom);
  if (isPending) return <EventListSkeleton />;
  if (isError) {
    return (
      <EventListNotice
        tone="danger"
        icon={<TriangleAlertIcon />}
        title="イベントを読み込めませんでした"
        description="通信状況をご確認の上再度お試しください。"
        action={
          <Button
            variant="outline"
            bg="bg.panel"
            size="lg"
            alignSelf="flex-start"
            onClick={() => void refetch()}
          >
            再試行
          </Button>
        }
      />
    );
  }
  const events = today ? data.filter((event) => event.period.end >= today) : data;
  if (events.length === 0) {
    return (
      <EventListNotice
        icon={<CalendarXIcon color="fg.muted" />}
        title="開催中・開催予定のイベントはまだありません"
        description="新しいイベントが告知されると、ここに出ます。"
      />
    );
  }
  return (
    <List.Root gap="2.5">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          status={today ? (event.period.start <= today ? "active" : "upcoming") : undefined}
          disabled={disabled}
          onCreate={onCreate}
        />
      ))}
    </List.Root>
  );
}

/**
 * Where the list goes while the events load: an event's card with its lines grayed, so the card
 * that comes after it, an event's or the error's, is as tall.
 */
function EventListSkeleton() {
  return (
    <Card.Root aria-hidden>
      <Card.Body>
        <Skeleton>
          <Text fontSize="md" fontWeight="bold">
            お買い物マラソン
          </Text>
        </Skeleton>
        <Skeleton>
          <Text fontSize="sm">10/14（水） 〜 10/17（土）・買いまわり最大 +9倍</Text>
        </Skeleton>
        <Skeleton>
          <Button size="lg">このイベントでプランを作る</Button>
        </Skeleton>
      </Card.Body>
    </Card.Root>
  );
}

type EventSectionProps = {
  /** Today in Japan as `YYYY-MM-DD`. */
  today: string | undefined;
  disabled: boolean;
  onCreate: (event: OfficialEvent) => void;
  onCreateWithoutEvent: () => void;
};

/**
 * The events come from the Worker, so the HTML rendered ahead of time has only the heading and the
 * button that needs no event.
 */
export function EventSection({
  today,
  disabled,
  onCreate,
  onCreateWithoutEvent,
}: EventSectionProps) {
  return (
    <VStack as="section" gap="2.5" alignItems="stretch">
      <ColumnHead>
        <Heading as="h2" fontSize="md">
          開催中・開催予定のイベント
        </Heading>
      </ColumnHead>
      <ClientOnly fallback={<EventListSkeleton />}>
        <EventList today={today} disabled={disabled} onCreate={onCreate} />
      </ClientOnly>
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
