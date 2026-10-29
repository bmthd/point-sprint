import type { OfficialEvent } from "@workspaces/domain";
import {
  Badge,
  Card,
  DataList,
  Flex,
  Heading,
  Link,
  List,
  NativeTable,
  Text,
  VStack,
} from "@workspaces/ui";
import type { ReactNode } from "react";
import { grouped } from "../../../ui/format";
import { formatPeriod } from "../../../ui/dates";
import { RouterButton } from "../../../ui/router-link";
import { PageWithSidebar } from "../-page-with-sidebar";
import {
  capReachingSpend,
  longPeriod,
  roundSentence,
  shopAroundOf,
  splitRounds,
} from "./marathon-rounds";

const checkedTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <VStack as="section" gap="3" alignItems="stretch">
      <Heading as="h2" fontSize="md">
        {title}
      </Heading>
      {children}
    </VStack>
  );
}

/** A round running or coming: what it pays, up to what, and where to enter. */
function RoundCard({ round, today }: { round: OfficialEvent; today: string }) {
  const shopAround = shopAroundOf(round);
  const spend = shopAround && capReachingSpend(shopAround);
  return (
    <Card.Root as="li" variant="outline">
      <Card.Body gap="3">
        <Flex align="center" gap="2" wrap="wrap">
          {round.period.start <= today ? (
            <Badge colorScheme="primary" variant="solid">
              開催中
            </Badge>
          ) : (
            <Badge colorScheme="mono" variant="outline">
              開催予定
            </Badge>
          )}
          <Heading as="h3" fontSize="md">
            {round.name}
          </Heading>
        </Flex>
        <DataList.Root size="sm" gridTemplateColumns="8em 1fr" fontVariantNumeric="tabular-nums">
          <DataList.Item>
            <DataList.Term>期間</DataList.Term>
            <DataList.Description>{longPeriod(round)}</DataList.Description>
          </DataList.Item>
          {shopAround ? (
            <>
              <DataList.Item>
                <DataList.Term>買いまわり</DataList.Term>
                <DataList.Description>
                  {shopAround.maxShops}ショップで +{shopAround.maxRate}倍（通常分と合わせて
                  {shopAround.maxRate + 1}倍）
                </DataList.Description>
              </DataList.Item>
              <DataList.Item>
                <DataList.Term>獲得上限</DataList.Term>
                <DataList.Description>
                  {shopAround.cap === undefined
                    ? "未発表（エントリーが始まると告知されます）"
                    : `${grouped(shopAround.cap)}ポイント`}
                </DataList.Description>
              </DataList.Item>
              {spend === undefined ? null : (
                <DataList.Item>
                  <DataList.Term>上限に届く買い物</DataList.Term>
                  <DataList.Description>
                    {shopAround.maxShops}ショップで税抜{grouped(spend)}円
                  </DataList.Description>
                </DataList.Item>
              )}
            </>
          ) : null}
          {round.url ? (
            <DataList.Item>
              <DataList.Term>公式ページ</DataList.Term>
              <DataList.Description>
                <Link href={round.url} color="link" target="_blank" rel="noreferrer">
                  楽天の告知ページ
                </Link>
              </DataList.Description>
            </DataList.Item>
          ) : null}
        </DataList.Root>
      </Card.Body>
    </Card.Root>
  );
}

/** The rounds that have ended, the latest first, with their caps. */
function PastRounds({ rounds }: { rounds: OfficialEvent[] }) {
  return (
    <NativeTable.Root size="sm" fontVariantNumeric="tabular-nums">
      <NativeTable.Thead>
        <NativeTable.Tr>
          <NativeTable.Th>回</NativeTable.Th>
          <NativeTable.Th>期間</NativeTable.Th>
          <NativeTable.Th numeric>上限</NativeTable.Th>
        </NativeTable.Tr>
      </NativeTable.Thead>
      <NativeTable.Tbody>
        {rounds.map((round) => {
          const cap = shopAroundOf(round)?.cap;
          return (
            <NativeTable.Tr key={round.id}>
              <NativeTable.Td>{round.name}</NativeTable.Td>
              <NativeTable.Td whiteSpace="nowrap">
                {round.period.start.slice(0, 4)}/{formatPeriod(round.period)}
              </NativeTable.Td>
              <NativeTable.Td numeric whiteSpace="nowrap">
                {cap === undefined ? "不明" : `${grouped(cap)}P`}
              </NativeTable.Td>
            </NativeTable.Tr>
          );
        })}
      </NativeTable.Tbody>
    </NativeTable.Root>
  );
}

export type MarathonPageProps = {
  /** Today in Japan as `YYYY-MM-DD`, from the server, so the HTML and the page agree. */
  today: string;
  /** The published marathon rounds, the earliest first. */
  rounds: OfficialEvent[];
  /** When collection last read Rakuten's pages, as an ISO timestamp. */
  checkedAt: string | undefined;
  /** The shopping guides to read next. */
  guides: { slug: string; title: string }[];
};

/**
 * `/marathon`: the marathon running or coming, and the ones before it, all from the event master.
 * One page for every round, rewritten as collection finds new ones, so that search engines keep
 * one URL for 「お買い物マラソン 11月」 and the like.
 */
export function MarathonPage({ today, rounds, checkedAt, guides }: MarathonPageProps) {
  const { ahead, past } = splitRounds(rounds, today);
  const [next] = ahead;
  return (
    <PageWithSidebar maxW="640px" card>
      <VStack gap="8" alignItems="stretch">
        <VStack gap="3" alignItems="stretch">
          <Heading as="h1" fontSize="lg">
            お買い物マラソンの日程と上限
          </Heading>
          <Text>
            {next
              ? roundSentence(next, today)
              : "次のお買い物マラソンは、まだ発表されていません。楽天が告知すると、このページに日程が出ます。"}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            日程と上限は、楽天のお買い物マラソンの告知ページから1日4回集めています。
            {checkedAt ? `最後に確かめたのは${checkedTime.format(new Date(checkedAt))}です。` : ""}
          </Text>
        </VStack>
        <Section title="開催中・開催予定の回">
          {ahead.length === 0 ? (
            <Text color="fg.muted">開催中・開催予定の回はありません。</Text>
          ) : (
            <List.Root gap="3">
              {ahead.map((round) => (
                <RoundCard key={round.id} round={round} today={today} />
              ))}
            </List.Root>
          )}
          <Text>買うものを入れると、獲得できるポイントと、上限までの残りを計算できます。</Text>
          <RouterButton to="/" colorScheme="primary" size="lg" alignSelf="flex-start">
            計算ツールでプランを作る
          </RouterButton>
        </Section>
        {past.length === 0 ? null : (
          <Section title="これまでの回">
            <PastRounds rounds={past} />
          </Section>
        )}
        {guides.length === 0 ? null : (
          <Section title="買い物ガイド">
            <List.Root gap="2" styleType="disc" ps="5">
              {guides.map((guide) => (
                <List.Item key={guide.slug}>
                  {/* Loads the page: the guide's items are in its prerendered HTML only. */}
                  <Link href={`/guides/${guide.slug}`} color="link">
                    {guide.title}
                  </Link>
                </List.Item>
              ))}
            </List.Root>
          </Section>
        )}
      </VStack>
    </PageWithSidebar>
  );
}
