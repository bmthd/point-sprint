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
import { grouped } from "#/ui/format.ts";
import { formatPeriod } from "#/ui/dates.ts";
import { RouterButton, RouterLink } from "#/ui/router-link.tsx";
import { GuideCard } from "#/routes/(site)/-guide-card.tsx";
import { PageWithSidebar } from "#/routes/(site)/-page-with-sidebar.tsx";
import { type FaqItem, marathonFaq } from "./marathon-faq.ts";
import {
  capReachingSpend,
  longPeriod,
  marathonHeading,
  roundSentence,
  shopAroundOf,
  splitRounds,
} from "./marathon-rounds.ts";

const checkedTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
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

/** The questions people search for, each answered in a sentence or two. */
function Faq({ faq }: { faq: FaqItem[] }) {
  return (
    <VStack gap="4" alignItems="stretch">
      {faq.map(({ question, answer }) => (
        <VStack key={question} gap="1" alignItems="stretch">
          <Heading as="h3" fontSize="sm">
            {question}
          </Heading>
          <Text>{answer}</Text>
        </VStack>
      ))}
    </VStack>
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
            {marathonHeading}
          </Heading>
          <Text>
            {next
              ? roundSentence(next, today)
              : "次のお買い物マラソンは、まだ発表されていません。楽天が告知すると、このページに日程が出ます。"}
            自分の買い物で上限に届くかは、
            <RouterLink to="/" color="link">
              ポイント計算ツール
            </RouterLink>
            で確かめられます。
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {checkedAt ? `${checkedTime.format(new Date(checkedAt))}更新。` : ""}
            日程と上限は、楽天のお買い物マラソンの告知ページから1日4回集めています。
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
        <Section title="よくある質問">
          <Faq faq={marathonFaq(rounds, today)} />
        </Section>
        {past.length === 0 ? null : (
          <Section title="これまでの回">
            <PastRounds rounds={past} />
          </Section>
        )}
        {guides.length === 0 ? null : (
          <Section title="買い物ガイド">
            {/* Breakpoints here apply from that width down: two columns, one on a phone. */}
            <List.Root
              display="grid"
              gridTemplateColumns={{ base: "repeat(2, minmax(0, 1fr))", md: "minmax(0, 1fr)" }}
              gap="2.5"
            >
              {guides.map((guide) => (
                <GuideCard key={guide.slug} article={guide} />
              ))}
            </List.Root>
          </Section>
        )}
      </VStack>
    </PageWithSidebar>
  );
}
