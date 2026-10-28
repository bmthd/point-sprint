import { type Plan, type SpuMonth, spuIdsIn, spuMonthsOfPlan } from "@workspaces/domain";
import { Button, Card, Flex, Heading, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { rounded } from "../../../ui/format";
import { accountIdOf } from "../../../state/accounts";
import { accountSettingsAtom } from "../../../state/derived";
import { spuMonthsAtom } from "../../../state/queries";
import { monthText } from "../-warnings";
import { spuMonthRate } from "./spu-month-editor";

/**
 * 「未設定・10月から引き継ぎ」 for a month the account has no SPU stored for: it takes over the
 * contracts of the nearest earlier month, if there is one. Nothing for a stored month.
 */
export function unsetNote(stored: SpuMonth[], accountId: string, month: string) {
  const own = stored.filter((candidate) => candidate.accountId === accountId);
  if (own.some((candidate) => candidate.month === month)) return undefined;
  const previous = own
    .map((candidate) => candidate.month)
    .filter((candidate) => candidate < month)
    .sort()
    .at(-1);
  return previous ? `未設定・${monthText(previous)}から引き継ぎ` : "未設定";
}

function ChangeButton({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <Button
      variant="outline"
      colorScheme="primary"
      size="sm"
      flex="none"
      aria-label={`${monthText(month)}の SPU を変更`}
      onClick={() => onChange(month)}
    >
      変更
    </Button>
  );
}

function Rate({ value }: { value: number }) {
  return (
    <Text
      as="span"
      fontSize="3xl"
      fontWeight="bold"
      lineHeight="1.1"
      whiteSpace="nowrap"
      fontVariantNumeric="tabular-nums"
    >
      {rounded(value)}
      <Text as="span" fontSize="md" fontWeight="medium">
        倍
      </Text>
    </Text>
  );
}

/** One row per month: its ポイント倍率, a note, and 「変更」 to open the month's SPU. */
export function SpuMonthRows({
  accountId,
  rows,
  onChange,
}: {
  accountId: string;
  rows: { month: string; note: ReactNode }[];
  onChange: (month: string) => void;
}) {
  const stored = useAtomValue(spuMonthsAtom);
  return rows.map(({ month, note }) => (
    <Flex
      key={month}
      align="center"
      gap="3"
      py="2.5"
      borderTopWidth="1px"
      borderColor="border"
      aria-label={`${monthText(month)}の SPU`}
      role="group"
    >
      <Text as="span" fontWeight="bold" w="10" flex="none">
        {monthText(month)}
      </Text>
      <Rate value={spuMonthRate(spuIdsIn(stored, accountId, month))} />
      <Text as="span" fontSize="xs" color="fg.muted" flex="1" minW="0">
        {note}
      </Text>
      <ChangeButton month={month} onChange={onChange} />
    </Flex>
  ));
}

/**
 * The plan's SPU: the ポイント倍率 of each month its orders are calculated with, each with 「変更」.
 * A plan of one month has one line.
 */
export function SpuSettingsCard({
  plan,
  title,
  note,
  onChange,
}: {
  plan: Plan;
  title: string;
  note: string;
  onChange: (month: string) => void;
}) {
  const settings = useAtomValue(accountSettingsAtom);
  const stored = useAtomValue(spuMonthsAtom);
  const accountId = accountIdOf(plan, settings);
  const months = spuMonthsOfPlan(plan);
  const [only] = months;
  if (months.length === 1 && only !== undefined) {
    return (
      <Card.Root as="section" aria-label={title}>
        <Card.Body flexDirection="row" alignItems="center" gap="3">
          <Flex direction="column" flex="1" minW="0">
            <Text fontSize="xs" fontWeight="bold" color="fg.muted">
              SPU（{monthText(only)}）
            </Text>
            <Rate value={spuMonthRate(spuIdsIn(stored, accountId, only))} />
          </Flex>
          <ChangeButton month={only} onChange={onChange} />
        </Card.Body>
      </Card.Root>
    );
  }
  return (
    <Card.Root as="section" aria-label={title}>
      <Card.Body alignItems="stretch" gap="2">
        <Flex wrap="wrap" align="baseline" justify="space-between" columnGap="2">
          <Heading as="h2" fontSize="md">
            {title}
          </Heading>
          <Text fontSize="xs" color="fg.muted">
            {note}
          </Text>
        </Flex>
        <div>
          <SpuMonthRows
            accountId={accountId}
            rows={months.map((month) => {
              const orders = plan.orders.filter((order) => order.date.startsWith(month)).length;
              const unset = unsetNote(stored, accountId, month);
              return {
                month,
                note: (
                  <>
                    注文 {orders}件{unset ? <br /> : null}
                    {unset}
                  </>
                ),
              };
            })}
            onChange={onChange}
          />
        </div>
      </Card.Body>
    </Card.Root>
  );
}
