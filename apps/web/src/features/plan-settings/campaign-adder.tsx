import {
  type CampaignTemplate,
  type Plan,
  campaignTemplates,
  hasCampaignOccurrence,
  instantiateCampaign,
} from "@workspaces/domain";
import {
  Box,
  Button,
  Field,
  Image,
  Input,
  List,
  Modal,
  SegmentedControl,
  Text,
  VStack,
} from "@workspaces/ui";
import { useSetAtom } from "jotai";
import { type ReactNode, useId, useState } from "react";
import * as v from "valibot";
import { addBenefitAtom } from "../../state/order-ops";
import { imageUrl } from "./settings-shared";

/** Which fields a template's form asks for, and the hint on its button. */
type FormSpec = {
  hint: string;
  /** One date and a +1 / +2 choice (a team that won, or both). */
  date?: boolean;
  period?: boolean;
  rate?: boolean;
  cap?: "optional" | "required";
  minOrderAmount?: boolean;
  label?: boolean;
};

const SPECS: Record<string, FormSpec> = {
  "sports-win": { hint: "勝った翌日と倍率", date: true },
  "39shop": { hint: "開催期間", period: true },
  repeat: { hint: "期間・条件金額・上限", period: true, minOrderAmount: true, cap: "required" },
  "shop-around-manual": { hint: "プリセットのない回", period: true, cap: "required" },
  "custom-rate": {
    hint: "倍率・上限・期間を自分で",
    label: true,
    period: true,
    rate: true,
    cap: "optional",
  },
};

/** The templates the user adds with dates or a period of their own, in the master's order. */
export const addableTemplates = campaignTemplates.filter(
  (template) => template.occurrence !== "fixed" && SPECS[template.id] !== undefined,
);

const normalize = (text: string) => text.normalize("NFKC").trim();
const DateText = v.pipe(v.string(), v.isoDate());
const isDate = (text: string) => v.is(DateText, text);
/** Whole points or yen: digits, with commas allowed. */
const parseWhole = (text: string) => {
  const digits = normalize(text).replace(/,/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : undefined;
};
const parseRate = (text: string) => {
  const value = Number(normalize(text));
  return normalize(text) !== "" && Number.isFinite(value) && value > 0 ? value : undefined;
};
const grouped = (value: number | undefined) =>
  value === undefined ? "" : value.toLocaleString("ja-JP");

/** The list of templates under 「＋ 追加」, two to a row. */
export function TemplateList({ onPick }: { onPick: (template: CampaignTemplate) => void }) {
  return (
    <List.Root
      aria-label="追加できるキャンペーン"
      pt="3"
      borderTopWidth="1px"
      borderColor="border"
      display="grid"
      gridTemplateColumns="repeat(2, minmax(0, 1fr))"
      gap="2"
    >
      {addableTemplates.map((template) => (
        <List.Item key={template.id}>
          {/* Two lines and an image: the button grows with them instead of its fixed height. */}
          <Button
            variant="outline"
            aria-label={`${template.name} ${SPECS[template.id]?.hint ?? ""}`.trim()}
            onClick={() => onPick(template)}
            w="full"
            h="auto"
            py="2"
            justifyContent="flex-start"
            textAlign="start"
            whiteSpace="normal"
            lineHeight="moderate"
          >
            <Box as="span" display="flex" alignItems="center" gap="2">
              {template.benefit.imagePath ? (
                <Image
                  src={imageUrl(template.benefit.imagePath)}
                  alt={template.name}
                  boxSize="10"
                  objectFit="contain"
                  flexShrink="0"
                />
              ) : null}
              <Box as="span">
                <Text as="span" display="block">
                  {template.name}
                </Text>
                <Text as="span" display="block" fontSize="xs" color="fg.muted">
                  {SPECS[template.id]?.hint}
                </Text>
              </Box>
            </Box>
          </Button>
        </List.Item>
      ))}
    </List.Root>
  );
}

/** A label above its field and the field's error under it; `Field` wires them to the field. */
function Labeled({
  label,
  error,
  children,
}: {
  label: string;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <Field.Root label={label} invalid={error !== undefined} errorMessage={error} minW="0">
      {children}
    </Field.Root>
  );
}

type Errors = Partial<Record<"date" | "start" | "end" | "rate" | "cap" | "minOrderAmount", string>>;

function CampaignForm({
  plan,
  template,
  onClose,
}: {
  plan: Plan;
  template: CampaignTemplate;
  onClose: () => void;
}) {
  const spec = SPECS[template.id] ?? { hint: "" };
  const addBenefit = useSetAtom(addBenefitAtom);
  const defaults = template.benefit;
  const defaultRate = defaults.kind === "rate-bonus" ? defaults.params.rate : 1;
  const [date, setDate] = useState(plan.period.start);
  const [choice, setChoice] = useState(defaultRate === 2 ? 2 : 1);
  const [start, setStart] = useState(plan.period.start);
  const [end, setEnd] = useState(plan.period.end);
  const [rate, setRate] = useState(String(defaultRate));
  const [cap, setCap] = useState(grouped(defaults.params.cap));
  const [minOrder, setMinOrder] = useState(grouped(defaults.conditions.minOrderAmount ?? 3980));
  const [label, setLabel] = useState(defaults.label);
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const formId = useId();
  const duplicateId = useId();

  const occurrence = spec.date
    ? { dates: isDate(date) ? [date] : [] }
    : { period: isDate(start) && isDate(end) ? { start, end } : undefined };
  const duplicate = hasCampaignOccurrence(plan, template, occurrence);

  const validate = () => {
    const next: Errors = {};
    if (spec.date && !isDate(date)) next.date = "日付を入れてください";
    if (spec.period) {
      if (!isDate(start)) next.start = "開始日を入れてください";
      if (!isDate(end)) next.end = "終了日を入れてください";
      else if (isDate(start) && end < start) next.end = "終了日は開始日より後にしてください";
    }
    if (spec.rate && parseRate(rate) === undefined)
      next.rate = "倍率は0より大きい数で入れてください";
    if (spec.cap) {
      const empty = normalize(cap) === "";
      if (empty && spec.cap === "required") next.cap = "獲得上限を入れてください";
      else if (!empty && parseWhole(cap) === undefined)
        next.cap = "獲得上限はポイントの整数で入れてください";
    }
    if (spec.minOrderAmount && parseWhole(minOrder) === undefined) {
      next.minOrderAmount = "条件金額は円の整数で入れてください";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (saving || duplicate || !validate()) return;
    const capValue = spec.cap ? parseWhole(cap) : undefined;
    const benefit = instantiateCampaign(template, {
      id: crypto.randomUUID(),
      ...(spec.date ? { dates: [date], rate: choice } : {}),
      ...(spec.period ? { period: { start, end } } : {}),
      ...(spec.rate ? { rate: parseRate(rate) } : {}),
      ...(capValue === undefined ? {} : { cap: capValue }),
      ...(spec.minOrderAmount ? { minOrderAmount: parseWhole(minOrder) } : {}),
      ...(spec.label && normalize(label) !== "" ? { label: normalize(label) } : {}),
    });
    setSaving(true);
    setFailed(false);
    try {
      await addBenefit({ planId: plan.id, benefit });
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Title as="h2">{template.name}を追加</Modal.Title>
      </Modal.Header>
      <Modal.Body alignItems="stretch">
        <VStack
          as="form"
          id={formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          gap="3"
          alignItems="stretch"
        >
          {spec.label ? (
            <Labeled label="名前" error={undefined}>
              <Input value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
            </Labeled>
          ) : null}
          {spec.date ? (
            <>
              <Labeled label="日付" error={errors.date}>
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.currentTarget.value)}
                />
              </Labeled>
              <SegmentedControl.Root
                aria-label="倍率"
                value={String(choice)}
                onChange={(value) => setChoice(Number(value))}
                w="full"
              >
                {[1, 2].map((value) => (
                  <SegmentedControl.Item key={value} value={String(value)}>
                    +{value}倍
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
              <Text fontSize="xs" color="fg.muted">
                片方のチームの勝利は +1倍、両方のチームが勝った日は +2倍です。
              </Text>
            </>
          ) : null}
          {spec.period ? (
            <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="2">
              <Labeled label="開始日" error={errors.start}>
                <Input
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.currentTarget.value)}
                />
              </Labeled>
              <Labeled label="終了日" error={errors.end}>
                <Input
                  type="date"
                  value={end}
                  onChange={(event) => setEnd(event.currentTarget.value)}
                />
              </Labeled>
            </Box>
          ) : null}
          {spec.rate ? (
            <Labeled label="倍率（+N倍）" error={errors.rate}>
              <Input
                inputMode="decimal"
                value={rate}
                onChange={(event) => setRate(event.currentTarget.value)}
              />
            </Labeled>
          ) : null}
          {spec.minOrderAmount ? (
            <Labeled label="条件金額（円）" error={errors.minOrderAmount}>
              <Input
                inputMode="numeric"
                value={minOrder}
                onChange={(event) => setMinOrder(event.currentTarget.value)}
              />
            </Labeled>
          ) : null}
          {spec.cap ? (
            <Labeled
              label={spec.cap === "required" ? "獲得上限（P）" : "獲得上限（P・任意）"}
              error={errors.cap}
            >
              <Input
                inputMode="numeric"
                value={cap}
                onChange={(event) => setCap(event.currentTarget.value)}
              />
            </Labeled>
          ) : null}
          {duplicate ? (
            <Text id={duplicateId} role="status" fontSize="sm" color="danger.fg">
              {spec.date
                ? `この日の${template.name}はもう追加してあります`
                : `この期間の${template.name}はもう追加してあります`}
            </Text>
          ) : null}
          {failed ? (
            <Text role="alert" fontSize="sm" color="danger.fg">
              追加できませんでした。もう一度お試しください。
            </Text>
          ) : null}
        </VStack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose} flex="1">
          キャンセル
        </Button>
        <Button
          type="submit"
          form={formId}
          colorScheme="primary"
          disabled={duplicate}
          aria-describedby={duplicate ? duplicateId : undefined}
          flex="1"
        >
          追加する
        </Button>
      </Modal.Footer>
    </>
  );
}

/** The dialog that adds a campaign from `template`, or nothing while `template` is undefined. */
export function CampaignAddDialog({
  plan,
  template,
  onClose,
}: {
  plan: Plan;
  template: CampaignTemplate | undefined;
  onClose: () => void;
}) {
  return (
    <Modal.Root
      open={template !== undefined}
      onClose={onClose}
      size="md"
      withCloseButton={false}
      restoreFocus
    >
      <Modal.Content>
        {template ? (
          <CampaignForm key={template.id} plan={plan} template={template} onClose={onClose} />
        ) : null}
      </Modal.Content>
    </Modal.Root>
  );
}
