import {
  type Benefit,
  type CampaignInput,
  type CampaignTemplate,
  type Plan,
  campaignTemplates,
  hasCampaignOccurrence,
  instantiateCampaign,
} from "@workspaces/domain";
import {
  Button,
  Flex,
  Heading,
  Image,
  Input,
  RadioCard,
  RadioCardGroup,
  Text,
} from "@workspaces/ui";
import { useSetAtom } from "jotai";
import { type Ref, useState } from "react";
import { addBenefitAtom, addBenefitsAtom } from "../../../state/order-ops";
import { tokyoToday } from "../../../ui/dates";
import { PlusIcon } from "../../../ui/icons";
import { imageUrl } from "../-order-shared";
import { PLACEHOLDER_CAP, SPECS } from "./campaign-form";
import { useSaveSettingsChange } from "./settings-shared";

/** The templates the user adds with dates or a period of their own, in the master's order. */
export const addableTemplates = campaignTemplates.filter(
  (template) => template.occurrence !== "fixed" && SPECS[template.id] !== undefined,
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
  if (template.benefit.kind === "shop-around" && plan.benefits.some(isShopAround)) return undefined;
  const cap =
    template.benefit.params.cap ?? (spec.cap === "required" ? PLACEHOLDER_CAP : undefined);
  const base = cap === undefined ? {} : { cap };
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

const isShopAround = (benefit: Benefit) => benefit.kind === "shop-around";

const SPORTS_CHOICES = [
  { rate: 1, imagePath: "/img/campaign/sports.webp", when: "片方のチームが勝った日" },
  { rate: 2, imagePath: "/img/campaign/sports-w.webp", when: "両方のチームが勝った日" },
] as const;

type SportsOccurrence = { date: string; rate: 1 | 2 };

const isIsoDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};

function SportsWinAdder({
  plan,
  onAdded,
  onFinished,
}: {
  plan: Plan;
  onAdded: (benefit: Benefit) => void;
  onFinished: () => void;
}) {
  const template = campaignTemplates.find((candidate) => candidate.id === "sports-win");
  if (!template) throw new Error("sports-win template is missing");
  const addBenefits = useSetAtom(addBenefitsAtom);
  const save = useSaveSettingsChange(plan.id);
  const first = defaultInputToday(plan, template);
  const initialDate = first?.dates?.[0];
  const [occurrences, setOccurrences] = useState<SportsOccurrence[]>(
    initialDate === undefined ? [] : [{ date: initialDate, rate: 1 }],
  );
  const taken = (date: string, index: number) =>
    hasCampaignOccurrence(plan, template, { dates: [date] }) ||
    occurrences.some((occurrence, other) => other !== index && occurrence.date === date);
  const valid =
    occurrences.length > 0 &&
    occurrences.every(
      (occurrence, index) => isIsoDate(occurrence.date) && !taken(occurrence.date, index),
    );

  const addOccurrence = () => {
    const occupied = new Set(occurrences.map(({ date }) => date));
    const date = daysOf(plan.period).find(
      (candidate) =>
        !occupied.has(candidate) && !hasCampaignOccurrence(plan, template, { dates: [candidate] }),
    );
    if (date) setOccurrences((current) => [...current, { date, rate: 1 }]);
  };
  const add = () => {
    if (!valid) return;
    const benefits = occurrences.map(({ date, rate }) =>
      instantiateCampaign(template, { id: crypto.randomUUID(), dates: [date], rate }),
    );
    const [firstBenefit] = benefits;
    if (!firstBenefit) return;
    const operation = addBenefits({ planId: plan.id, benefits });
    save(operation);
    void operation
      .then(() => {
        onFinished();
        onAdded(firstBenefit);
      })
      .catch(() => {});
  };

  return (
    <Flex direction="column" gap="3" borderTopWidth="1px" borderColor="border" pt="3">
      <Heading as="h3" fontSize="sm">
        勝ったら倍を追加
      </Heading>
      {occurrences.map((occurrence, index) => {
        const invalidDate = !isIsoDate(occurrence.date);
        const duplicate = taken(occurrence.date, index);
        const error = invalidDate
          ? "日付を入力してください"
          : duplicate
            ? "この日の勝ったら倍はもう追加してあります"
            : undefined;
        return (
          <Flex key={`${index}:${occurrence.date}`} direction="column" gap="2">
            <Input
              type="date"
              aria-label={`日付 ${index + 1}`}
              value={occurrence.date}
              onChange={(event) => {
                const date = event.currentTarget.value;
                setOccurrences((current) =>
                  current.map((item, other) => (other === index ? { ...item, date } : item)),
                );
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `sports-date-error-${index}` : undefined}
            />
            {error ? (
              <Text id={`sports-date-error-${index}`} role="alert" fontSize="sm" color="danger.fg">
                {error}
              </Text>
            ) : null}
            <RadioCardGroup.Root
              aria-label={`倍率 ${index + 1}`}
              value={String(occurrence.rate)}
              onChange={(value) =>
                setOccurrences((current) =>
                  current.map((item, other) =>
                    other === index ? { ...item, rate: Number(value) === 2 ? 2 : 1 } : item,
                  ),
                )
              }
              colorScheme="primary"
              size="sm"
              withIndicator={false}
              display="grid"
              gridTemplateColumns="repeat(2, minmax(0, 1fr))"
              gap="2"
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
                  <Image src={imageUrl(option.imagePath)} alt="" boxSize="10" objectFit="contain" />
                  <RadioCard.Label>+{option.rate}倍</RadioCard.Label>
                  <RadioCard.Description>{option.when}</RadioCard.Description>
                </RadioCard.Root>
              ))}
            </RadioCardGroup.Root>
          </Flex>
        );
      })}
      <Flex gap="2" wrap="wrap">
        <Button variant="outline" colorScheme="primary" onClick={addOccurrence}>
          開催を追加
        </Button>
        <Button colorScheme="primary" disabled={!valid} onClick={add}>
          追加する
        </Button>
      </Flex>
    </Flex>
  );
}

/**
 * A button for each template. 勝ったら倍 opens a form to add several occurrences together; the
 * other templates add `defaultInput` at once. A template the plan already has is greyed out as
 * 「追加済み」.
 */
export function CampaignAddButtons({
  plan,
  firstRef,
  onAdded,
}: {
  plan: Plan;
  firstRef?: Ref<HTMLButtonElement>;
  onAdded: (benefit: Benefit) => void;
}) {
  const addBenefit = useSetAtom(addBenefitAtom);
  const save = useSaveSettingsChange(plan.id);
  const [addingSportsWin, setAddingSportsWin] = useState(false);

  const add = (template: CampaignTemplate) => {
    const input = defaultInputToday(plan, template);
    if (!input) return;
    const benefit = instantiateCampaign(template, { id: crypto.randomUUID(), ...input });
    const operation = addBenefit({ planId: plan.id, benefit });
    save(operation);
    void operation.then(() => onAdded(benefit)).catch(() => {});
  };

  return (
    <Flex direction="column" gap="2">
      <Text fontSize="xs" color="fg.muted">
        勝ったら倍は開催をまとめて追加できます。ほかは押すとプランの期間で追加します。
      </Text>
      <Flex
        as="ul"
        listStyle="none"
        m="0"
        p="0"
        wrap="wrap"
        gap="2"
        aria-label="キャンペーンを追加"
      >
        {addableTemplates.map((template, index) => {
          // Whether any day is left does not depend on today, which a render cannot read.
          const full = defaultInput(plan, template, plan.period.start) === undefined;
          const imagePath = template.benefit.imagePath;
          return (
            <li key={template.id}>
              <Button
                ref={index === 0 ? firstRef : undefined}
                variant="outline"
                colorScheme="primary"
                disabled={full}
                aria-label={full ? `${template.name}（追加済み）` : `${template.name}を追加`}
                onClick={() => {
                  if (template.id === "sports-win") setAddingSportsWin(true);
                  else add(template);
                }}
                startIcon={<PlusIcon />}
                gap="1.5"
              >
                {imagePath ? (
                  <Image src={imageUrl(imagePath)} alt="" boxSize="6" objectFit="contain" />
                ) : null}
                {template.name}
              </Button>
            </li>
          );
        })}
      </Flex>
      {addingSportsWin ? (
        <SportsWinAdder
          plan={plan}
          onAdded={onAdded}
          onFinished={() => setAddingSportsWin(false)}
        />
      ) : null}
    </Flex>
  );
}
