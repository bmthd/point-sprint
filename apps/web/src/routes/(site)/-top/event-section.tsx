import type { OfficialEvent } from "@workspaces/domain";
import {
  Badge,
  Box,
  Button,
  CalendarXIcon,
  Card,
  Drawer,
  Flex,
  Grid,
  Heading,
  List,
  Skeleton,
  Text,
  TriangleAlertIcon,
  VStack,
  useDisclosure,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { type ReactNode, useId } from "react";
import { grouped } from "../../../ui/format";
import { monthDay, monthDayWithWeekday } from "../../../ui/dates";
import { officialEventsQueryAtom } from "../../-official-events";
import { SaveFailed } from "./hero";
import { endedLatestFirst } from "./start-target";

/**
 * The highest rate and the cap of each shop-around and spend-tiers benefit, e.g.
 * 「買いまわり最大 +9倍・上限 7,000P」 or 「合計額で最大 +4倍・上限 4,000P」. `short` leaves out what
 * the rate is on, for a phone's one line.
 */
function tiersSummary(event: OfficialEvent, short = false): string {
  return event.benefits
    .flatMap((benefit) => {
      if (benefit.kind !== "shop-around" && benefit.kind !== "spend-tiers") return [];
      const { tiers, cap } = benefit.params;
      const maxRate = Math.max(...tiers.map((tier) => tier.rate));
      // A round is listed from the schedule page before its own page tells the cap.
      const capText = cap === undefined ? "上限は未発表" : `上限 ${grouped(cap)}P`;
      const what = short ? "" : benefit.kind === "shop-around" ? "買いまわり" : "合計額で";
      return [`${what}最大 +${maxRate}倍・${capText}`];
    })
    .join("・");
}

type Status = "active" | "upcoming" | "ended";

const statusOf = (event: OfficialEvent, today: string | undefined): Status | undefined =>
  !today
    ? undefined
    : event.period.end < today
      ? "ended"
      : event.period.start <= today
        ? "active"
        : "upcoming";

function StatusBadge({ status }: { status: Status }) {
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

type CreateProps = {
  disabled: boolean;
  onCreate: (event: OfficialEvent) => void;
};

/**
 * An event's card: its name and terms on the left, the button on the right. A phone has the terms
 * on one short line, so the card stays low.
 */
function EventCard({
  event,
  status,
  disabled,
  onCreate,
  actionLabel,
}: { event: OfficialEvent; status: Status | undefined; actionLabel: string } & CreateProps) {
  return (
    <Card.Root h="full">
      <Card.Body flexDirection="row" alignItems="center" gap={{ base: "4", md: "3" }}>
        <VStack flex="1" minW="0" gap="1" alignItems="stretch">
          <Flex align="center" gap="2" minW="0">
            {status ? <StatusBadge status={status} /> : null}
            <Text fontSize={{ base: "md", md: "sm" }} fontWeight="bold" truncated>
              {event.name}
            </Text>
          </Flex>
          <Text
            fontSize="sm"
            color="fg.muted"
            fontVariantNumeric="tabular-nums"
            display={{ base: "block", md: "none" }}
          >
            {monthDayWithWeekday(event.period.start)}
            {event.times?.start} 〜 {monthDayWithWeekday(event.period.end)}
            {event.times?.end}
            <br />
            {tiersSummary(event)}
          </Text>
          <Text
            fontSize="xs"
            color="fg.muted"
            fontVariantNumeric="tabular-nums"
            truncated
            display={{ base: "none", md: "block" }}
          >
            {monthDay(event.period.start)}〜{monthDay(event.period.end)}・
            {tiersSummary(event, true)}
          </Text>
        </VStack>
        <Button
          colorScheme="primary"
          size={{ base: "lg", md: "md" }}
          flexShrink="0"
          disabled={disabled}
          onClick={() => onCreate(event)}
        >
          {actionLabel}
        </Button>
      </Card.Body>
    </Card.Root>
  );
}

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

/**
 * Where the cards go while the events load: an event's card with its lines grayed, so the card
 * that comes after it, an event's or the error's, is as tall.
 */
function EventCardSkeleton() {
  return (
    <Card.Root aria-hidden>
      <Card.Body flexDirection="row" alignItems="center" gap="4">
        <VStack flex="1" minW="0" gap="1" alignItems="stretch">
          <Skeleton>
            <Text fontWeight="bold">お買い物マラソン</Text>
          </Skeleton>
          <Skeleton>
            <Text fontSize="sm">10/14（水） 〜 10/17（土）</Text>
          </Skeleton>
        </VStack>
        <Skeleton flexShrink="0">
          <Button size="lg">プランを作る</Button>
        </Skeleton>
      </Card.Body>
    </Card.Root>
  );
}

/** `2026-09-19` as `2026年9月`. */
const yearMonth = (date: string) => `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月`;

/**
 * The button to the events that ended and the drawer it opens: a panel for each month they started
 * in, the latest first. From the bottom on a phone, from the side otherwise.
 */
function EndedEvents({ events, disabled, onCreate }: { events: OfficialEvent[] } & CreateProps) {
  const { open, onOpen, onClose } = useDisclosure();
  const months = new Map<string, OfficialEvent[]>();
  for (const event of events) {
    const month = yearMonth(event.period.start);
    months.set(month, [...(months.get(month) ?? []), event]);
  }
  return (
    <>
      <Button variant="ghost" colorScheme="link" size="sm" px="0" flexShrink="0" onClick={onOpen}>
        終了したイベント（{events.length} 件）
      </Button>
      <Drawer.Root
        open={open}
        onClose={onClose}
        placement={{ base: "inline-end", md: "block-end" }}
        size="lg"
      >
        <Drawer.Content
          bg="bg.base"
          maxH={{ base: "none", md: "calc(100dvh - 24px)" }}
          roundedTop={{ base: "0", md: "l2" }}
        >
          <Drawer.Header bg="bg.panel" borderBottomWidth="1px">
            <Drawer.Title fontSize="md">終了したイベント</Drawer.Title>
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
                          <Text fontSize="xs" color="fg.muted">
                            {tiersSummary(event)}
                          </Text>
                        </VStack>
                        <Button
                          variant="outline"
                          bg="bg.panel"
                          flexShrink="0"
                          disabled={disabled}
                          onClick={() => {
                            onClose();
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

type EventSectionProps = CreateProps & {
  /** Today in Japan as `YYYY-MM-DD`; `undefined` where nothing sets it, as in some tests. */
  today: string | undefined;
  onCreateWithoutEvent: () => void;
  /** That the plan started here could not be saved. */
  failed: boolean;
};

/**
 * The events under the hero: the ones running and to come, or the latest that ended when none is
 * ahead, and the rest of the ended ones behind a button. The heading and its button are on the
 * left on a wide screen, above the cards on a phone. The cards are two to a row on a wide screen,
 * so one card does not stretch across the page: with an odd number, the last place has the button
 * that needs no event. A phone scrolls the cards sideways, so the section is as tall with two.
 */
export function EventSection({
  today,
  disabled,
  onCreate,
  onCreateWithoutEvent,
  failed,
}: EventSectionProps) {
  const headingId = useId();
  const { data, isPending, isError, refetch } = useAtomValue(officialEventsQueryAtom);

  const events = isPending || isError ? [] : data;
  const ahead = today ? events.filter((event) => event.period.end >= today) : events;
  const ended = today ? endedLatestFirst(events, today) : [];
  const [latestEnded, ...earlier] = ended;
  // With nothing ahead, the latest that ended takes the cards' place, under its own heading.
  const showEnded = !isPending && !isError && ahead.length === 0 && latestEnded !== undefined;
  const cards = showEnded ? [latestEnded] : ahead;
  const behind = showEnded ? earlier : ended;

  const withoutEvent = (
    <Button
      variant="outline"
      bg="bg.panel"
      size="lg"
      disabled={disabled}
      onClick={onCreateWithoutEvent}
    >
      イベントを選ばずにプランを作る
    </Button>
  );

  let content: ReactNode;
  if (isPending) {
    content = <EventCardSkeleton />;
  } else if (isError) {
    content = (
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
  } else if (cards.length === 0) {
    content = (
      <EventListNotice
        icon={<CalendarXIcon color="fg.muted" />}
        title="開催中・開催予定のイベントはまだありません"
        description="新しいイベントが告知されると、ここに出ます。"
      />
    );
  } else {
    const odd = cards.length % 2 === 1;
    content = (
      // The list lays its cards out in the box around it, so the card that needs no event takes the
      // last place in the grid without being one of the events.
      <Box
        display={{ base: "grid", md: "flex" }}
        gridTemplateColumns="repeat(2, minmax(0, 1fr))"
        gap={{ base: "3", md: "2" }}
        overflowX={{ base: "visible", md: "auto" }}
        scrollSnapType={{ base: "none", md: "x mandatory" }}
        // The cards scroll to the screen's edge on a phone.
        me={{ base: "0", md: "-5" }}
        pe={{ base: "0", md: "5" }}
      >
        <List.Root aria-labelledby={headingId} display="contents">
          {cards.map((event) => (
            <List.Item
              key={event.id}
              flex={{ base: "initial", md: cards.length > 1 ? "0 0 88%" : "1 0 100%" }}
              scrollSnapAlign={{ base: "none", md: "start" }}
            >
              <EventCard
                event={event}
                status={statusOf(event, today)}
                actionLabel={showEnded ? "この条件で計算" : "プランを作る"}
                disabled={disabled}
                onCreate={onCreate}
              />
            </List.Item>
          ))}
        </List.Root>
        {odd ? (
          <Box display={{ base: "block", md: "none" }}>
            <Card.Root h="full" variant="outline" bg="transparent" borderStyle="dashed">
              <Card.Body flexDirection="row" alignItems="center" gap="4">
                <VStack flex="1" minW="0" gap="1" alignItems="stretch">
                  <Text fontWeight="bold">イベントのない買い物</Text>
                  <Text fontSize="sm" color="fg.muted">
                    買うものだけで計算できます
                  </Text>
                </VStack>
                {withoutEvent}
              </Card.Body>
            </Card.Root>
          </Box>
        ) : null}
      </Box>
    );
  }

  const oddCards = cards.length % 2 === 1 && !isPending && !isError;

  return (
    <Box as="section" id="events" aria-labelledby={headingId}>
      {/* Breakpoints here apply from that width down. */}
      <Grid
        maxW="1280px"
        mx="auto"
        px={{ base: "6", md: "5" }}
        pt={{ base: "6", md: "5" }}
        pb={{ base: "8", md: "4" }}
        gridTemplateColumns={{ base: "160px minmax(0, 1fr)", md: "minmax(0, 1fr)" }}
        columnGap="6"
        rowGap="3"
        alignItems="center"
      >
        <Flex
          direction={{ base: "column", md: "row" }}
          align={{ base: "flex-start", md: "center" }}
          justify={{ base: "flex-start", md: "space-between" }}
          gap="1"
        >
          <VStack gap="0.5" alignItems="stretch">
            <Heading as="h2" id={headingId} fontSize="md" tabIndex={-1}>
              {showEnded ? "前回のイベント" : "イベント"}
            </Heading>
            {showEnded ? (
              <Text fontSize="xs" color="fg.muted">
                次回の日程は未発表です
              </Text>
            ) : null}
          </VStack>
          {behind.length > 0 ? (
            <EndedEvents events={behind} disabled={disabled} onCreate={onCreate} />
          ) : null}
        </Flex>
        <VStack alignItems="stretch" gap="3" minW="0">
          {content}
          {/* Under the cards when the last place has no room for it, and always on a phone. */}
          <Box display={oddCards ? { base: "none", md: "block" } : undefined}>
            <Button
              variant="ghost"
              colorScheme="link"
              size={{ base: "lg", md: "sm" }}
              px={{ base: "4", md: "0" }}
              disabled={disabled}
              onClick={onCreateWithoutEvent}
            >
              イベントを選ばずにプランを作る
            </Button>
          </Box>
          {failed ? <SaveFailed /> : null}
        </VStack>
      </Grid>
    </Box>
  );
}
