import {
  type Benefit,
  type CampaignInput,
  type CampaignTemplate,
  type Plan,
  campaignTemplates,
  comesWithPlan,
  hasCampaignOccurrence,
  instantiateCampaign,
  inDateRule,
  isTwoShopCampaign,
  newId,
} from "@workspaces/domain";
import { Button, Flex, Image, List, Text, PlusIcon } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import type { Ref } from "react";
import { planAtom } from "#/state/derived.ts";
import { addBenefitAtom } from "#/state/plan-operations.ts";
import { tokyoToday } from "#/ui/dates.ts";
import { imageUrl } from "#/routes/(plan)/-order-shared.tsx";
import { PLACEHOLDER_CAP, SPECS } from "./campaign-form.ts";
import { useSaveSettingsChange } from "./settings-shared.ts";

/** The templates the user adds with dates or a period of their own, in the master's order. */
export const addableTemplates = campaignTemplates.filter(
  (template) => !comesWithPlan(template) && SPECS[template.id] !== undefined,
);

/** Every day of `period`, from its start. */
function daysOf(period: Plan["period"]) {
  const days: string[] = [];
  const day = new Date(`${period.start}T00:00:00Z`);
  for (let text = period.start; text <= period.end;) {
    days.push(text);
    day.setUTCDate(day.getUTCDate() + 1);
    text = day.toISOString().slice(0, 10);
  }
  return days;
}

/**
 * What a template is added with at once: the plan's days, the master's rate and cap, and a
 * placeholder cap where one is needed and the master has none. A day campaign takes today, or the
 * first day after it that it does not have yet. `undefined` when the plan already has it for every
 * such choice.
 */
export function defaultInput(
  plan: Plan,
  template: CampaignTemplate,
  today: string,
): CampaignInput | undefined {
  const spec = SPECS[template.id] ?? {};
  if (isShopAround(template.benefit) && plan.benefits.some(isShopAround)) {
    return undefined;
  }
  const cap =
    template.benefit.params.cap ?? (spec.cap === "required" ? PLACEHOLDER_CAP : undefined);
  const base = cap === undefined ? {} : { cap };
  if (template.occurrence === "fixed") {
    const rule = template.benefit.conditions.dateRule;
    if (rule && !daysOf(plan.period).some((day) => inDateRule(rule, day))) return undefined;
    return hasCampaignOccurrence(plan, template, {}) ? undefined : base;
  }
  if (template.occurrence === "user-dates") {
    const days = daysOf(plan.period);
    const from = today >= plan.period.start && today <= plan.period.end ? today : plan.period.start;
    const free = [...days.filter((day) => day >= from), ...days.filter((day) => day < from)].find(
      (day) => !hasCampaignOccurrence(plan, template, { dates: [day] }),
    );
    return free === undefined ? undefined : { ...base, dates: [free] };
  }
  if (hasCampaignOccurrence(plan, template, { period: plan.period })) return undefined;
  return { ...base, period: { ...plan.period } };
}

/** `defaultInput` as of now, for an event handler. */
const defaultInputToday = (plan: Plan, template: CampaignTemplate) =>
  defaultInput(plan, template, tokyoToday(new Date()));

/** The plan's own shop-around. A 2ショップ購入 beside it is a campaign of its own days. */
const isShopAround = (benefit: Benefit) =>
  benefit.kind === "shop-around" && !isTwoShopCampaign(benefit);

/**
 * A button for each template that adds it at once with `defaultInput`. What it was added with is
 * changed afterwards in its row. A template the plan already has is greyed out as 「追加済み」.
 */
export function CampaignAddButtons({
  planId,
  firstRef,
  onAdded,
}: {
  planId: string;
  firstRef?: Ref<HTMLButtonElement>;
  onAdded: (benefit: Benefit) => void;
}) {
  const plan = useAtomValue(planAtom(planId));
  const addBenefit = useSetAtom(addBenefitAtom);
  const save = useSaveSettingsChange(planId);

  if (!plan) return null;
  const add = (template: CampaignTemplate) => {
    const input = defaultInputToday(plan, template);
    if (!input) return;
    const benefit = instantiateCampaign(template, { id: newId(), ...input });
    const operation = addBenefit({ planId: plan.id, benefit });
    save(operation);
    void operation.then(() => onAdded(benefit)).catch(() => {});
  };

  return (
    <Flex direction="column" gap="2">
      <Text fontSize="xs" color="fg.muted">
        押すとプランの期間で追加します。期間や倍率は追加した後に ✎ で変えられます。
      </Text>
      <List.Root flexDirection="row" flexWrap="wrap" gap="2" aria-label="キャンペーンを追加">
        {addableTemplates.map((template, index) => {
          // Whether any day is left does not depend on today, which a render cannot read.
          const full = defaultInput(plan, template, plan.period.start) === undefined;
          const unavailable =
            full && template.occurrence === "fixed" && !hasCampaignOccurrence(plan, template, {});
          const reason = unavailable ? "この期間に開催日がありません" : "追加済み";
          const imagePath = template.benefit.imagePath;
          return (
            <List.Item key={template.id} maxW="full">
              {/* The reason a button is disabled is long; let it wrap on a phone. */}
              <Button
                maxW="full"
                h="auto"
                minH="10"
                py="1.5"
                lineHeight="short"
                whiteSpace="normal"
                textAlign="start"
                ref={index === 0 ? firstRef : undefined}
                variant="outline"
                colorScheme="primary"
                disabled={full}
                aria-label={full ? `${template.name}（${reason}）` : `${template.name}を追加`}
                onClick={() => add(template)}
                startIcon={<PlusIcon />}
                gap="1.5"
              >
                {imagePath ? (
                  <Image src={imageUrl(imagePath)} alt="" boxSize="6" objectFit="contain" />
                ) : null}
                {template.name}
                {unavailable ? `（${reason}）` : null}
              </Button>
            </List.Item>
          );
        })}
      </List.Root>
    </Flex>
  );
}
