import {
  type Benefit,
  type CampaignInput,
  type CampaignTemplate,
  type Plan,
  campaignInputOf,
  editCampaign,
  hasCampaignOccurrence,
} from "@workspaces/domain";
import { Box, Button, Flex, Image, RadioCard, RadioCardGroup, Text } from "@workspaces/ui";
import { useSetAtom } from "jotai";
import * as v from "valibot";
import { optionalGrouped } from "../../../ui/format";
import { CommitField } from "../-form/commit-field";
import { CommitDatePicker } from "../-date-picker-field";
import {
  END_BEFORE_START,
  START_AFTER_END,
  dateSchema,
  optionalPointsSchema,
  pointsSchema,
  rateSchema,
  requiredTextSchema,
  yenSchema,
} from "@workspaces/domain";
import { updateBenefitAtom } from "../../../state/plan-operations";
import { imageUrl } from "../-order-shared";
import { SPECS } from "./campaign-form";
import { useSaveSettingsChange } from "./settings-shared";

/** The images of 勝ったら倍's two choices: one team won, or both did. */
const SPORTS_CHOICES = [
  { rate: 1, imagePath: "/img/campaign/sports.webp", when: "片方のチームが勝った日" },
  { rate: 2, imagePath: "/img/campaign/sports-w.webp", when: "両方のチームが勝った日" },
] as const;

/** ご愛顧感謝デー's rate by the member's rank. シルバー and レギュラー do not get it. */
const RANK_CHOICES = [
  { rate: 1, when: "ゴールド会員" },
  { rate: 2, when: "プラチナ会員" },
  { rate: 3, when: "ダイヤモンド会員" },
] as const;

const twoColumns = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  alignItems: "start",
  gap: "2",
} as const;

/** A card for each rate the campaign can have, with when it has it. */
function RateChoices({
  choices,
  rate,
  onChange,
}: {
  choices: readonly { rate: number; imagePath?: string; when: string }[];
  rate: number;
  onChange: (rate: number) => void;
}) {
  return (
    <RadioCardGroup.Root
      aria-label="倍率"
      value={String(rate)}
      onChange={(value) => onChange(Number(value))}
      colorScheme="primary"
      size="sm"
      withIndicator={false}
      display="grid"
      gridTemplateColumns={`repeat(${choices.length}, minmax(0, 1fr))`}
      alignItems="start"
      gap="2"
    >
      {choices.map((option) => (
        <RadioCard.Root
          key={option.rate}
          value={String(option.rate)}
          flexDirection="column"
          alignItems="center"
          textAlign="center"
          gap="1"
        >
          {option.imagePath ? (
            <Image src={imageUrl(option.imagePath)} alt="" boxSize="12" objectFit="contain" />
          ) : null}
          <RadioCard.Label fontVariantNumeric="tabular-nums">+{option.rate}倍</RadioCard.Label>
          <RadioCard.Description>{option.when}</RadioCard.Description>
        </RadioCard.Root>
      ))}
    </RadioCardGroup.Root>
  );
}

/**
 * A campaign's values under its row, each saved on Enter or when it loses the focus, and the button
 * that deletes it. A day or a period the plan already has for the same template is refused.
 */
export function CampaignEditor({
  id,
  plan,
  benefit,
  template,
  onDelete,
}: {
  id: string;
  plan: Plan;
  benefit: Benefit;
  template: CampaignTemplate;
  onDelete: () => void;
}) {
  const updateBenefit = useSetAtom(updateBenefitAtom);
  const save = useSaveSettingsChange(plan.id);
  const spec = SPECS[template.id] ?? {};
  const input = campaignInputOf(benefit);
  const others = { ...plan, benefits: plan.benefits.filter((other) => other.id !== benefit.id) };
  const taken = (occurrence: { dates?: string[]; period?: Plan["period"] }) =>
    hasCampaignOccurrence(others, template, occurrence);

  /** Saves `change` over the campaign as it is when the change is applied. */
  const change = (edit: (current: CampaignInput) => CampaignInput) => {
    const operation = updateBenefit({
      planId: plan.id,
      benefitId: benefit.id,
      change: (current) => editCampaign(template, current, edit(campaignInputOf(current))),
    });
    save(operation);
    return operation;
  };
  const set = (values: CampaignInput) => change(() => values);

  const period = input.period ?? plan.period;
  const date = input.dates?.[0] ?? plan.period.start;
  const rate = input.rate ?? 1;

  return (
    <Flex id={id} direction="column" gap="2.5" borderTopWidth="1px" borderColor="border" pt="3">
      {spec.label ? (
        <CommitField
          key={`label:${benefit.label}`}
          label="名前"
          initial={benefit.label}
          schema={requiredTextSchema("名前", 50)}
          onCommit={(label) => set({ label })}
        />
      ) : null}
      {spec.date ? (
        <>
          <CommitDatePicker
            key={`date:${date}`}
            label="日付"
            initial={date}
            schema={v.pipe(
              dateSchema("日付"),
              v.check(
                (day) => !taken({ dates: [day] }),
                `この日の${template.name}はもう追加してあります`,
              ),
            )}
            period={plan.period}
            onCommit={(day) => set({ dates: [day] })}
          />
          {spec.winChoice ? (
            <RateChoices
              choices={SPORTS_CHOICES}
              rate={rate}
              onChange={(value) => void set({ rate: value })}
            />
          ) : null}
        </>
      ) : null}
      {spec.rank ? (
        <RateChoices
          choices={RANK_CHOICES}
          rate={rate}
          onChange={(value) => void set({ rate: value })}
        />
      ) : null}
      {spec.period ? (
        <Box {...twoColumns}>
          <CommitDatePicker
            key={`start:${period.start}:${period.end}`}
            label="開始日"
            initial={period.start}
            schema={v.pipe(
              dateSchema("開始日"),
              v.check((start) => start <= period.end, START_AFTER_END),
              v.check(
                (start) => !taken({ period: { start, end: period.end } }),
                `この期間の${template.name}はもう追加してあります`,
              ),
            )}
            period={plan.period}
            onCommit={(start) =>
              change((current) => ({ period: { start, end: current.period?.end ?? period.end } }))
            }
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
            onCommit={(end) =>
              change((current) => ({
                period: { start: current.period?.start ?? period.start, end },
              }))
            }
          />
        </Box>
      ) : null}
      {spec.rate || spec.minOrderAmount || spec.cap ? (
        <Box {...twoColumns}>
          {spec.rate ? (
            <CommitField
              key={`rate:${rate}`}
              label="倍率（+N倍）"
              initial={String(rate)}
              schema={rateSchema("倍率")}
              inputMode="decimal"
              align="end"
              onCommit={(value) => set({ rate: value })}
            />
          ) : null}
          {spec.minOrderAmount ? (
            <CommitField
              key={`min:${input.minOrderAmount ?? ""}`}
              label="条件金額（円）"
              initial={optionalGrouped(input.minOrderAmount)}
              schema={yenSchema("条件金額")}
              inputMode="numeric"
              align="end"
              onCommit={(minOrderAmount) => set({ minOrderAmount })}
            />
          ) : null}
          {spec.cap === "required" ? (
            <CommitField
              key={`cap:${input.cap ?? ""}`}
              label="獲得上限（P）"
              initial={optionalGrouped(input.cap)}
              schema={pointsSchema("獲得上限")}
              inputMode="numeric"
              align="end"
              onCommit={(cap) => set({ cap })}
            />
          ) : null}
          {spec.cap === "optional" ? (
            <CommitField
              key={`cap:${input.cap ?? ""}`}
              label="獲得上限（P・任意）"
              initial={optionalGrouped(input.cap)}
              schema={optionalPointsSchema("獲得上限")}
              inputMode="numeric"
              align="end"
              onCommit={(cap) => set({ cap })}
            />
          ) : null}
        </Box>
      ) : null}
      <Text fontSize="xs" color="fg.muted">
        Enter か、欄の外を押すと保存します。
      </Text>
      <Button variant="outline" colorScheme="danger" onClick={onDelete} alignSelf="flex-start">
        {benefit.label}を削除
      </Button>
    </Flex>
  );
}
