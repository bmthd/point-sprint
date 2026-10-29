import type { OfficialEvent } from "@workspaces/domain";
import {
  Badge,
  Button,
  CalendarXIcon,
  Card,
  Drawer,
  Flex,
  Heading,
  Link,
  List,
  Skeleton,
  Tabs,
  Text,
  TriangleAlertIcon,
  VStack,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { type ReactNode, useState } from "react";
import { grouped } from "../../../ui/format";
import { monthDayWithWeekday } from "../../../ui/dates";
import { officialEventsQueryAtom } from "../../-official-events";
import { ColumnHead } from "../../../ui/column-head";

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
      const capText = cap === undefined ? "・上限は未発表" : `・上限 ${grouped(cap)}P`;
      const what = benefit.kind === "shop-around" ? "買いまわり" : "合計額で";
      return `・${what}最大 +${maxRate}倍${capText}`;
    })
    .join("");
}

type EventCardProps = {
  event: OfficialEvent;
  /** `undefined` before the date is known: the card then has no status badge. */
  status: "active" | "upcoming" | "ended" | undefined;
  disabled: boolean;
  onCreate: (event: OfficialEvent) => void;
};

function StatusBadge({ status }: { status: "active" | "upcoming" | "ended" }) {
  switch (status) {
    case "active":
      return (
        <Badge colorScheme="primary" variant="solid">
          開催中
        </Badge>
      );
    case "upcoming":
      return (
        <Badge colorScheme="mono" variant="outline">
          開催予定
        </Badge>
      );
    case "ended":
      return (
        <Badge colorScheme="gray" variant="subtle">
          終了
        </Badge>
      );
  }
}

function EventCard({ event, status, disabled, onCreate }: EventCardProps) {
  return (
    <List.Item>
      <Card.Root>
        <Card.Body>
          <Flex align="center" gap="2">
            {status ? <StatusBadge status={status} /> : null}
            {event.url ? (
              // The name is the link, underlined rather than given an icon: a row of the link's own,
              // or an icon beside the name, would make the card taller than its skeleton on a phone.
              <Link
                href={event.url}
                color="fg"
                fontSize="md"
                fontWeight="bold"
                textDecoration="underline"
                textUnderlineOffset="0.2em"
                target="_blank"
                rel="noreferrer"
              >
                {event.name}
              </Link>
            ) : (
              <Text fontSize="md" fontWeight="bold">
                {event.name}
              </Text>
            )}
          </Flex>
          <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
            {monthDayWithWeekday(event.period.start)}
            {event.times?.start} 〜 {monthDayWithWeekday(event.period.end)}
            {event.times?.end}
            {tiersSummary(event)}
          </Text>
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

/** How long an ended event stays on its tab; older ones are behind 「もっと見る」. */
const RECENT_DAYS = 30;

/** `date` moved back by `days`, both as `YYYY-MM-DD`. */
const daysBefore = (date: string, days: number): string =>
  new Date(Date.parse(date) - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * The events split by `today`: the ones that have not ended, the ones that ended within
 * `RECENT_DAYS`, and the older ones. The ended ones are the latest first.
 */
function splitEvents(events: OfficialEvent[], today: string | undefined) {
  if (!today) return { ahead: events, recent: [], older: [] };
  const ended = events
    .filter((event) => event.period.end < today)
    .sort((a, b) => (a.period.end < b.period.end ? 1 : -1));
  const cutoff = daysBefore(today, RECENT_DAYS);
  return {
    ahead: events.filter((event) => event.period.end >= today),
    recent: ended.filter((event) => event.period.end >= cutoff),
    older: ended.filter((event) => event.period.end < cutoff),
  };
}

function EventCards({
  events,
  today,
  disabled,
  onCreate,
}: { events: OfficialEvent[] } & EventListProps) {
  return (
    <List.Root gap="2.5">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          status={
            !today
              ? undefined
              : event.period.end < today
                ? "ended"
                : event.period.start <= today
                  ? "active"
                  : "upcoming"
          }
          disabled={disabled}
          onCreate={onCreate}
        />
      ))}
    </List.Root>
  );
}

/**
 * The heading and the two tabs. The tabs sit on the heading's row, so the cards start on the same
 * line as the sidebar's. Each panel holds `ahead` or `ended`, or the same thing while the events
 * load.
 */
function EventTabs({
  index,
  onChange,
  ahead,
  ended,
}: {
  index: number;
  onChange?: (index: number) => void;
  ahead: ReactNode;
  ended: ReactNode;
}) {
  return (
    <Tabs.Root index={index} onChange={onChange} size="sm" gap="2.5">
      <ColumnHead>
        <Heading as="h2" fontSize="md">
          イベント
        </Heading>
        <Tabs.List>
          <Tabs.Tab index={0}>開催中・開催予定</Tabs.Tab>
          <Tabs.Tab index={1}>終了</Tabs.Tab>
        </Tabs.List>
      </ColumnHead>
      <Tabs.Panel index={0} p="0">
        {ahead}
      </Tabs.Panel>
      <Tabs.Panel index={1} p="0">
        {ended}
      </Tabs.Panel>
    </Tabs.Root>
  );
}

/**
 * The events the page was rendered with, or read from the Worker once the page runs when it was
 * not: on a visit from another page, or when the Worker could not read them.
 */
function EventList({ today, disabled, onCreate }: EventListProps) {
  const { data, isPending, isError, refetch } = useAtomValue(officialEventsQueryAtom);
  // Until a tab is chosen, the ended events show when nothing is ahead.
  const [chosen, setChosen] = useState<number>();
  if (isPending) {
    return <EventTabs index={0} ahead={<EventListSkeleton />} ended={<EventListSkeleton />} />;
  }
  if (isError) {
    const notice = (
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
    return <EventTabs index={chosen ?? 0} onChange={setChosen} ahead={notice} ended={notice} />;
  }
  const { ahead, recent, older } = splitEvents(data, today);
  const props = { today, disabled, onCreate };
  return (
    <EventTabs
      index={chosen ?? (ahead.length === 0 && recent.length + older.length > 0 ? 1 : 0)}
      onChange={setChosen}
      ahead={
        ahead.length === 0 ? (
          <EventListNotice
            icon={<CalendarXIcon color="fg.muted" />}
            title="開催中・開催予定のイベントはまだありません"
            description="新しいイベントが告知されると、ここに出ます。"
          />
        ) : (
          <EventCards events={ahead} {...props} />
        )
      }
      ended={
        <VStack gap="2.5" alignItems="stretch">
          {recent.length === 0 ? (
            <EventListNotice
              icon={<CalendarXIcon color="fg.muted" />}
              title={`この ${RECENT_DAYS} 日に終わったイベントはありません`}
              description={
                older.length === 0
                  ? "イベントが終わると、ここに出ます。"
                  : "それより前のイベントは「もっと見る」から選べます。"
              }
            />
          ) : (
            <EventCards events={recent} {...props} />
          )}
          {older.length === 0 ? null : <OlderEvents events={older} {...props} />}
        </VStack>
      }
    />
  );
}

/** `2026-09-19` as `2026年9月`. */
const yearMonth = (date: string) => `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月`;

/**
 * 「もっと見る」 and the drawer it opens: the events that ended before `RECENT_DAYS`, a panel for
 * each month they started in, the latest first. From the bottom on a phone, from the side otherwise.
 */
function OlderEvents({ events, disabled, onCreate }: { events: OfficialEvent[] } & EventListProps) {
  const [open, setOpen] = useState(false);
  const months = new Map<string, OfficialEvent[]>();
  for (const event of events) {
    const month = yearMonth(event.period.start);
    months.set(month, [...(months.get(month) ?? []), event]);
  }
  return (
    <>
      <Button
        variant="ghost"
        colorScheme="link"
        size="lg"
        alignSelf="flex-start"
        onClick={() => setOpen(true)}
      >
        もっと見る
      </Button>
      <Drawer.Root
        open={open}
        onClose={() => setOpen(false)}
        placement={{ base: "inline-end", md: "block-end" }}
        size="lg"
      >
        <Drawer.Content bg="bg.base" maxH={{ md: "calc(100dvh - 24px)" }} roundedTop={{ md: "l2" }}>
          <Drawer.Header bg="bg.panel" borderBottomWidth="1px">
            <Drawer.Title fontSize="md">それより前のイベント</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body py="4" gap="5">
            {[...months].map(([month, monthEvents]) => (
              <VStack key={month} as="section" gap="2" alignItems="stretch">
                <Heading as="h3" fontSize="sm" color="fg.muted">
                  {month}
                </Heading>
                <Card.Root>
                  <List.Root>
                    {monthEvents.map((event) => (
                      <List.Item
                        key={event.id}
                        display="flex"
                        alignItems="center"
                        gap="3"
                        px="4"
                        py="2.5"
                        _notFirst={{ borderTopWidth: "1px" }}
                      >
                        <VStack gap="0.5" flex="1" minW="0" alignItems="stretch">
                          <Text fontWeight="bold">{event.name}</Text>
                          <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
                            {monthDayWithWeekday(event.period.start)} 〜{" "}
                            {monthDayWithWeekday(event.period.end)}
                          </Text>
                          {/* On a line of its own, without the dot that joins it to the period. */}
                          <Text fontSize="xs" color="fg.muted">
                            {tiersSummary(event).replace(/^・/, "")}
                          </Text>
                        </VStack>
                        <Button
                          variant="outline"
                          bg="bg.panel"
                          flexShrink="0"
                          disabled={disabled}
                          onClick={() => {
                            setOpen(false);
                            onCreate(event);
                          }}
                        >
                          プランを作る
                        </Button>
                      </List.Item>
                    ))}
                  </List.Root>
                </Card.Root>
              </VStack>
            ))}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </>
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

/** The events, and the button that needs no event. */
export function EventSection({
  today,
  disabled,
  onCreate,
  onCreateWithoutEvent,
}: EventSectionProps) {
  return (
    <VStack as="section" gap="2.5" alignItems="stretch">
      <EventList today={today} disabled={disabled} onCreate={onCreate} />
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
