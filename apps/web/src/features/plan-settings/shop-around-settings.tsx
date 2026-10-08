import { type Benefit, type Plan, officialEvents } from "@workspaces/domain";
import { Box, Button, Card, Text } from "@workspaces/ui";
import { useSetAtom } from "jotai";
import { useId, useRef, useState } from "react";
import * as v from "valibot";
import { updateBenefitAtom } from "../../state/order-ops";
import { ChevronIcon } from "../plan-home/icons";
import { CommitField } from "../../form/commit-field";
import {
  END_BEFORE_START,
  START_AFTER_END,
  dateSchema,
  pointsSchema,
} from "../../form/field-schemas";
import { rateText } from "../plan-home/order-shared";
import { isAddedCampaign } from "./campaign-toggles";
import { useDeleteCampaign } from "./delete-campaign";
import { useSaveSettingsChange, whenText } from "./settings-shared";

type ShopAroundBenefit = Extract<Benefit, { kind: "shop-around" }>;

/** The plan's first shop-around benefit, the one the calculation's outlook follows. */
export const shopAroundOf = (plan: Plan) =>
  plan.benefits.find((benefit): benefit is ShopAroundBenefit => benefit.kind === "shop-around");

const CapSchema = pointsSchema("獲得上限");

const grouped = (value: number) => value.toLocaleString("ja-JP");

/** One line about the shop-around: when, the highest rate and the cap. */
function summaryOf(benefit: ShopAroundBenefit, period: { start: string; end: string }) {
  const maxRate = Math.max(...benefit.params.tiers.map((tier) => tier.rate));
  const cap = benefit.params.cap;
  return [
    whenText(benefit.conditions.dateRule ?? { type: "range", ...period }),
    `最大 ${rateText(maxRate)}`,
    cap === undefined ? "上限なし" : `上限 ${grouped(cap)}P`,
  ].join("・");
}

/** 「買いまわりと上限」: a one-line summary that opens to override its period and cap. */
export function ShopAroundSettings({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const deletion = useDeleteCampaign(plan, sectionRef);
  const benefit = shopAroundOf(plan);

  return (
    <Card.Root
      as="section"
      ref={sectionRef}
      tabIndex={-1}
      aria-label="買いまわりと上限"
      overflow="hidden"
    >
      {benefit ? (
        <ShopAroundEditor
          plan={plan}
          benefit={benefit}
          open={open}
          onToggle={() => setOpen((value) => !value)}
          onDelete={() => deletion.ask(benefit)}
        />
      ) : (
        <Text px="4" py="3" fontSize="sm" color="fg.muted">
          このプランに買いまわりはありません。プリセットのない回は「＋
          追加」の「買いまわり（手動）」で作れます。
        </Text>
      )}
      {deletion.dialog}
    </Card.Root>
  );
}

function ShopAroundEditor({
  plan,
  benefit,
  open,
  onToggle,
  onDelete,
}: {
  plan: Plan;
  benefit: ShopAroundBenefit;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const updateBenefit = useSetAtom(updateBenefitAtom);
  const save = useSaveSettingsChange(plan.id);
  const panelId = useId();
  const added = isAddedCampaign(plan, benefit);

  const name =
    officialEvents.find((event) => event.id === plan.officialEventId)?.name ?? benefit.label;
  const rule = benefit.conditions.dateRule;
  const period = rule?.type === "range" ? { start: rule.start, end: rule.end } : plan.period;
  const change = (next: (current: ShopAroundBenefit) => ShopAroundBenefit) => {
    const operation = updateBenefit({
      planId: plan.id,
      benefitId: benefit.id,
      change: (current) => (current.kind === "shop-around" ? next(current) : current),
    });
    save(operation);
    return operation;
  };
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
        py="3"
        gap="3"
        textAlign="start"
        whiteSpace="normal"
        lineHeight="moderate"
      >
        <Box as="span" flex="1" display="flex" flexDirection="column" gap="0.5" minW="0">
          <Text as="span" fontSize="md" fontWeight="bold">
            {name}
          </Text>
          <Text as="span" fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
            {summaryOf(benefit, period)}
          </Text>
        </Box>
        <Text as="span" fontSize="sm" color="primary.fg">
          変更
        </Text>
        <ChevronIcon open={open} />
      </Button>
      {open ? (
        <Box
          id={panelId}
          borderTopWidth="1px"
          borderColor="border"
          px="4"
          pt="3"
          pb="4"
          display="flex"
          flexDirection="column"
          gap="2.5"
        >
          <Box
            display="grid"
            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            alignItems="start"
            gap="2"
          >
            <CommitField
              key={`start:${period.start}:${period.end}`}
              label="開始日"
              initial={period.start}
              schema={v.pipe(
                dateSchema("開始日"),
                v.check((start) => start <= period.end, START_AFTER_END),
              )}
              onCommit={(start) => withPeriod({ start })}
            />
            <CommitField
              key={`end:${period.start}:${period.end}`}
              label="終了日"
              initial={period.end}
              schema={v.pipe(
                dateSchema("終了日"),
                v.check((end) => end >= period.start, END_BEFORE_START),
              )}
              onCommit={(end) => withPeriod({ end })}
            />
          </Box>
          <CommitField
            key={`cap:${benefit.params.cap ?? ""}`}
            label="獲得上限"
            initial={benefit.params.cap === undefined ? "" : grouped(benefit.params.cap)}
            schema={CapSchema}
            inputMode="numeric"
            align="end"
            placeholder="ポイント"
            onCommit={(cap) =>
              change((current) => ({ ...current, params: { ...current.params, cap } }))
            }
          />
          <Text fontSize="xs" color="fg.muted">
            {added
              ? "開催回に合わせて期間と上限を入れてください。"
              : "公式イベントのプリセットから作成。開催回で違うときは上書きできます。"}
            Enter か、欄の外を押すと保存します。
          </Text>
          {added ? (
            <Button
              variant="outline"
              colorScheme="danger"
              onClick={onDelete}
              alignSelf="flex-start"
            >
              この買いまわりを削除
            </Button>
          ) : null}
        </Box>
      ) : null}
    </>
  );
}
