import { type Benefit, type Plan, type SpendTier, spendTierRate } from "@workspaces/domain";
import { Box, Button, Card, Fieldset, Flex, IconButton, Text } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, useId, useRef, useState } from "react";
import * as v from "valibot";
import { grouped, rateText, yen } from "../../../ui/format";
import { CommitField } from "../../../form/commit-field";
import {
  END_BEFORE_START,
  MAX_RATE,
  START_AFTER_END,
  dateSchema,
  pointsSchema,
  rateSchema,
  requiredTextSchema,
  yenSchema,
} from "../../../form/field-schemas";
import { planResultAtom } from "../../../state/derived";
import { updateBenefitAtom } from "../../../state/order-ops";
import { ChevronIcon, CloseIcon, PlusIcon } from "../../../ui/icons";
import { CommitDatePicker } from "../-date-picker-field";
import { isAddedCampaign, isFixedCampaign } from "./campaign-toggles";
import { useDeleteCampaign } from "./delete-campaign";
import { useSaveSettingsChange, whenText } from "./settings-shared";

type SpendTiersBenefit = Extract<Benefit, { kind: "spend-tiers" }>;

/** A fixed one (ワンダフルデー) is among the campaigns, since its days and tiers never change. */
const spendTiersOf = (plan: Plan) =>
  plan.benefits.filter(
    (benefit): benefit is SpendTiersBenefit =>
      benefit.kind === "spend-tiers" && !isFixedCampaign(benefit),
  );

/** The yen a new tier starts from above the highest one, and the rate it adds to it. */
const NEXT_TIER_STEP = { minAmount: 5000, rate: 1 };

const byMinAmount = (a: SpendTier, b: SpendTier) => a.minAmount - b.minAmount;

/** One line about the campaign: when, the highest rate and the cap. */
function summaryOf(benefit: SpendTiersBenefit, period: Plan["period"]) {
  const maxRate = Math.max(...benefit.params.tiers.map((tier) => tier.rate));
  const cap = benefit.params.cap;
  return [
    whenText(benefit.conditions.dateRule ?? { type: "range", ...period }),
    `最大 ${rateText(maxRate)}`,
    cap === undefined ? "上限なし" : `上限 ${grouped(cap)}P`,
  ].join("・");
}

/** 「いまの合計 ¥X で +N倍。あと ¥Y で +M倍」: where the total stands among the tiers. */
function standingOf(tiers: SpendTier[], total: number) {
  const rate = spendTierRate(tiers, total);
  const next = [...tiers].sort(byMinAmount).find((tier) => tier.minAmount > total);
  const now = `いまの合計 ${yen(total)}（税込）で ${rateText(rate)}。`;
  return next ? `${now}あと ${yen(next.minAmount - total)} で ${rateText(next.rate)}。` : now;
}

/**
 * A card for each campaign whose rate the total over its days sets: a one-line summary that opens
 * to change its name, period, tiers and cap.
 */
export function SpendTiersSettings({ plan }: { plan: Plan }) {
  return spendTiersOf(plan).map((benefit) => (
    <SpendTiersCard key={benefit.id} plan={plan} benefit={benefit} />
  ));
}

function SpendTiersCard({ plan, benefit }: { plan: Plan; benefit: SpendTiersBenefit }) {
  const [open, setOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const deletion = useDeleteCampaign(plan, sectionRef);
  return (
    <Card.Root
      as="section"
      ref={sectionRef}
      tabIndex={-1}
      aria-label={benefit.label}
      overflow="hidden"
    >
      <SpendTiersEditor
        plan={plan}
        benefit={benefit}
        open={open}
        onToggle={() => setOpen((value) => !value)}
        onDelete={() => deletion.ask(benefit)}
      />
      {deletion.dialog}
    </Card.Root>
  );
}

function SpendTiersEditor({
  plan,
  benefit,
  open,
  onToggle,
  onDelete,
}: {
  plan: Plan;
  benefit: SpendTiersBenefit;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const updateBenefit = useSetAtom(updateBenefitAtom);
  const save = useSaveSettingsChange(plan.id);
  const result = useAtomValue(planResultAtom(plan.id));
  const panelId = useId();
  const added = isAddedCampaign(plan, benefit);

  const rule = benefit.conditions.dateRule;
  const period = rule?.type === "range" ? { start: rule.start, end: rule.end } : plan.period;
  const { tiers } = benefit.params;
  const change = (next: (current: SpendTiersBenefit) => SpendTiersBenefit) => {
    const operation = updateBenefit({
      planId: plan.id,
      benefitId: benefit.id,
      change: (current) => (current.kind === "spend-tiers" ? next(current) : current),
    });
    save(operation);
    return operation;
  };
  /** Changes the tiers as they are when the change is applied, kept from the lowest total up. */
  const withTiers = (edit: (current: SpendTier[]) => SpendTier[]) =>
    change((current) => ({
      ...current,
      params: { ...current.params, tiers: edit(current.params.tiers).sort(byMinAmount) },
    }));
  /**
   * Changes one end of the period. The other end is read from the benefit as it is when the change
   * is applied, so two dates committed one right after the other both stay.
   */
  const withPeriod = (edited: { start: string } | { end: string }) =>
    change((current) => {
      const currentRule = current.conditions.dateRule;
      const base = currentRule?.type === "range" ? currentRule : plan.period;
      return {
        ...current,
        conditions: {
          ...current.conditions,
          dateRule: { type: "range", start: base.start, end: base.end, ...edited },
        },
      };
    });
  const highest = tiers.reduce((top, tier) => (tier.minAmount > top.minAmount ? tier : top));
  const total = result?.spendTotals[benefit.id];

  return (
    <>
      {/* The summary takes two lines, so the row grows with it instead of the button's fixed height. */}
      <Button
        variant="ghost"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        w="full"
        h="auto"
        roundedBottom={open ? "0" : undefined}
        py="3"
        gap="3"
        textAlign="start"
        whiteSpace="normal"
        lineHeight="moderate"
      >
        <Flex as="span" flex="1" direction="column" gap="0.5" minW="0">
          <Text as="span" fontSize="md" fontWeight="bold">
            {benefit.label}
          </Text>
          <Text as="span" fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
            {summaryOf(benefit, period)}
          </Text>
        </Flex>
        <Text as="span" fontSize="sm" color="primary.fg">
          変更
        </Text>
        <ChevronIcon open={open} />
      </Button>
      {open ? (
        <Flex
          id={panelId}
          borderTopWidth="1px"
          borderColor="border"
          px="4"
          pt="3"
          pb="4"
          direction="column"
          gap="2.5"
        >
          {added ? (
            <CommitField
              key={`label:${benefit.label}`}
              label="名前"
              initial={benefit.label}
              schema={requiredTextSchema("名前", 50)}
              onCommit={(label) => change((current) => ({ ...current, label }))}
            />
          ) : null}
          <Box
            display="grid"
            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            alignItems="start"
            gap="2"
          >
            <CommitDatePicker
              key={`start:${period.start}:${period.end}`}
              label="開始日"
              initial={period.start}
              schema={v.pipe(
                dateSchema("開始日"),
                v.check((start) => start <= period.end, START_AFTER_END),
              )}
              period={plan.period}
              onCommit={(start) => withPeriod({ start })}
            />
            <CommitDatePicker
              key={`end:${period.start}:${period.end}`}
              label="終了日"
              initial={period.end}
              schema={v.pipe(
                dateSchema("終了日"),
                v.check((end) => end >= period.start, END_BEFORE_START),
              )}
              period={plan.period}
              onCommit={(end) => withPeriod({ end })}
            />
          </Box>
          <Fieldset.Root legend="段階（期間中の合計額・税込）" size="sm" gap="2">
            {/* The columns' names once, above every tier's fields; each field names its tier. */}
            <TierColumns aria-hidden>
              <Text fontSize="sm">合計額（円以上）</Text>
              <Text fontSize="sm">倍率（+N倍）</Text>
            </TierColumns>
            {tiers.map((tier, index) => (
              <TierRow
                key={`tier:${index}:${tier.minAmount}:${tier.rate}`}
                index={index}
                tier={tier}
                others={tiers.filter((_, other) => other !== index)}
                onCommit={(edited) =>
                  withTiers((current) =>
                    current.map((each, other) => (other === index ? edited : each)),
                  )
                }
                onRemove={
                  tiers.length > 1
                    ? () => withTiers((current) => current.filter((_, other) => other !== index))
                    : undefined
                }
              />
            ))}
            <Button
              variant="outline"
              colorScheme="primary"
              alignSelf="flex-start"
              startIcon={<PlusIcon />}
              onClick={() =>
                void withTiers((current) => [
                  ...current,
                  {
                    minAmount: highest.minAmount + NEXT_TIER_STEP.minAmount,
                    rate: Math.min(MAX_RATE, highest.rate + NEXT_TIER_STEP.rate),
                  },
                ])
              }
            >
              段階を足す
            </Button>
          </Fieldset.Root>
          <CommitField
            key={`cap:${benefit.params.cap ?? ""}`}
            label="獲得上限（P）"
            initial={benefit.params.cap === undefined ? "" : grouped(benefit.params.cap)}
            schema={pointsSchema("獲得上限")}
            inputMode="numeric"
            align="end"
            onCommit={(cap) =>
              change((current) => ({ ...current, params: { ...current.params, cap } }))
            }
          />
          {total === undefined ? null : (
            <Text fontSize="sm" fontVariantNumeric="tabular-nums">
              {standingOf(tiers, total)}
            </Text>
          )}
          <Text fontSize="xs" color="fg.muted">
            合計した額で決まった倍率が、期間中のすべての注文につきます。保留の注文は合計しません。Enter
            か、欄の外を押すと保存します。
          </Text>
          {added ? (
            <Button
              variant="outline"
              colorScheme="danger"
              onClick={onDelete}
              alignSelf="flex-start"
            >
              {benefit.label}を削除
            </Button>
          ) : null}
        </Flex>
      ) : null}
    </>
  );
}

/** Two columns, the total and the rate, and room for a tier's remove button beside them. */
function TierColumns({ children, ...rest }: { children: ReactNode; "aria-hidden"?: boolean }) {
  return (
    <Flex align="center" gap="2" {...rest}>
      <Box
        flex="1"
        display="grid"
        gridTemplateColumns="repeat(2, minmax(0, 1fr))"
        alignItems="start"
        gap="2"
      >
        {children}
      </Box>
      <Box w="11" flexShrink="0" />
    </Flex>
  );
}

/** One tier: the total it starts from and the rate it gives, and the button that removes it. */
function TierRow({
  index,
  tier,
  others,
  onCommit,
  onRemove,
}: {
  index: number;
  tier: SpendTier;
  others: SpendTier[];
  onCommit: (tier: SpendTier) => Promise<unknown>;
  onRemove: (() => void) | undefined;
}) {
  const name = `${index + 1}段目`;
  return (
    <Flex align="flex-start" gap="2">
      <Box
        flex="1"
        display="grid"
        gridTemplateColumns="repeat(2, minmax(0, 1fr))"
        alignItems="start"
        gap="2"
      >
        <CommitField
          label={`${name}の合計額（円以上）`}
          hideLabel
          initial={grouped(tier.minAmount)}
          schema={v.pipe(
            yenSchema("合計額"),
            v.check(
              (minAmount) => others.every((other) => other.minAmount !== minAmount),
              "同じ合計額の段階がもうあります",
            ),
          )}
          inputMode="numeric"
          align="end"
          onCommit={(minAmount) => onCommit({ ...tier, minAmount })}
        />
        <CommitField
          label={`${name}の倍率（+N倍）`}
          hideLabel
          initial={String(tier.rate)}
          schema={rateSchema("倍率")}
          inputMode="decimal"
          align="end"
          onCommit={(rate) => onCommit({ ...tier, rate })}
        />
      </Box>
      <Box boxSize="11" flexShrink="0">
        {onRemove ? (
          <IconButton variant="ghost" aria-label={`${name}を削除`} onClick={onRemove}>
            <CloseIcon />
          </IconButton>
        ) : null}
      </Box>
    </Flex>
  );
}
