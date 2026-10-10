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
import { CommitField } from "../../../form/commit-field";
import {
  END_BEFORE_START,
  START_AFTER_END,
  dateSchema,
  optionalPointsSchema,
  pointsSchema,
  rateSchema,
  requiredTextSchema,
  yenSchema,
} from "../../../form/field-schemas";
import { updateBenefitAtom } from "../../../state/order-ops";
import { imageUrl } from "../-order-shared";
import { SPECS } from "./campaign-form";
import { useSaveSettingsChange } from "./settings-shared";
import { SportsWinAdder } from "./sports-win-adder";

/** The images of 勝ったら倍's two choices: one team won, or both did. */
const SPORTS_CHOICES = [
  { rate: 1, imagePath: "/img/campaign/sports.webp", when: "片方のチームが勝った日" },
  { rate: 2, imagePath: "/img/campaign/sports-w.webp", when: "両方のチームが勝った日" },
] as const;

const grouped = (value: number | undefined) =>
  value === undefined ? "" : value.toLocaleString("ja-JP");

const twoColumns = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  alignItems: "start",
  gap: "2",
} as const;

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
          <CommitField
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
            onCommit={(day) => set({ dates: [day] })}
          />
          <RadioCardGroup.Root
            aria-label="倍率"
            value={String(rate)}
            onChange={(value) => void set({ rate: Number(value) })}
            colorScheme="primary"
            size="sm"
            withIndicator={false}
            {...twoColumns}
          >
            {SPORTS_CHOICES.map((option) => (
              <RadioCard.Root
                key={option.rate}
                value={String(option.rate)}
                flexDirection="column"
                alignItems="center"
                textAlign="center"
                gap="1"
              >
                <Image src={imageUrl(option.imagePath)} alt="" boxSize="12" objectFit="contain" />
                <RadioCard.Label fontVariantNumeric="tabular-nums">
                  +{option.rate}倍
                </RadioCard.Label>
                <RadioCard.Description>{option.when}</RadioCard.Description>
              </RadioCard.Root>
            ))}
          </RadioCardGroup.Root>
        </>
      ) : null}
      {spec.period ? (
        <Box {...twoColumns}>
          <CommitField
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
            onCommit={(start) =>
              change((current) => ({ period: { start, end: current.period?.end ?? period.end } }))
            }
          />
          <CommitField
            key={`end:${period.start}:${period.end}`}
            label="終了日"
            initial={period.end}
            schema={v.pipe(
              dateSchema("終了日"),
              v.check((end) => end >= period.start, END_BEFORE_START),
            )}
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
              initial={grouped(input.minOrderAmount)}
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
              initial={grouped(input.cap)}
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
              initial={grouped(input.cap)}
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
      {spec.date ? <SportsWinAdder plan={plan} benefit={benefit} template={template} /> : null}
      <Button variant="outline" colorScheme="danger" onClick={onDelete} alignSelf="flex-start">
        {benefit.label}を削除
      </Button>
    </Flex>
  );
}
