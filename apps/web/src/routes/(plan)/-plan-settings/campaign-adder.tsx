// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import {
  type CampaignTemplate,
  type Plan,
  campaignTemplates,
  hasCampaignOccurrence,
  instantiateCampaign,
} from "@workspaces/domain";
import { Field as FormField, type FormStore, setInput, useField, useForm } from "@formisch/react";
import {
  Box,
  Button,
  DatePicker,
  type DatePickerProps,
  Field,
  HStack,
  Image,
  Input,
  List,
  Modal,
  RadioCard,
  RadioCardGroup,
  Text,
  VStack,
  useFieldProps,
} from "@workspaces/ui";
import { useSetAtom } from "jotai";
import { useId, useState } from "react";
import * as v from "valibot";
import { dateSchema } from "../../../form/field-schemas";
import { Form, bind, errorsOf } from "../../../form/form";
import { addBenefitAtom } from "../../../state/order-ops";
import { type CampaignFormSchema, SPECS, campaignFormSchema } from "./campaign-form";
import { imageUrl } from "./settings-shared";

/** The templates the user adds with dates or a period of their own, in the master's order. */
export const addableTemplates = campaignTemplates.filter(
  (template) => template.occurrence !== "fixed" && SPECS[template.id] !== undefined,
);

const DateText = dateSchema("日付");
const isDate = (text: unknown): text is string => v.is(DateText, text);
const grouped = (value: number | undefined) =>
  value === undefined ? "" : value.toLocaleString("ja-JP");

/** `2026-10-06` → that day at midnight here, or `undefined` for anything else. */
const parseIsoDate = (text: unknown) => {
  if (!isDate(text)) return undefined;
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day);
};

/** A day → `2026-10-06`, the text the form's date fields hold. */
const isoDate = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

/** How a date field shows its day: `2026/10/06`. */
const DATE_FORMAT = { input: { year: "numeric", month: "2-digit", day: "2-digit" } } as const;

/** The images of 勝ったら倍's two choices: one team won, or both did. */
const SPORTS_CHOICES = [
  { rate: 1, imagePath: "/img/campaign/sports.webp", when: "片方のチームが勝った日" },
  { rate: 2, imagePath: "/img/campaign/sports-w.webp", when: "両方のチームが勝った日" },
] as const;

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

/** A text field of the form, its label above it and its error under it. */
function TextField({
  form,
  name,
  label,
  inputMode,
}: {
  form: FormStore<CampaignFormSchema>;
  name: "label" | "rate" | "minOrderAmount" | "cap";
  label: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <FormField of={form} path={[name]}>
      {(field) => (
        <Field.Root label={label} {...errorsOf(field)} minW="0">
          <Input inputMode={inputMode} {...bind(field)} />
        </Field.Root>
      )}
    </FormField>
  );
}

/**
 * A `DatePicker` in a `Field`. The picker puts the field's `aria-invalid` and error description on
 * its box, not on the input that has the label, so they are given to the input as well.
 */
function FieldDatePicker(props: DatePickerProps) {
  const { ariaProps } = useFieldProps();
  return (
    <DatePicker
      locale="ja"
      format={DATE_FORMAT}
      placeholder="YYYY/MM/DD"
      openOnFocus={false}
      openOnChange={false}
      fontVariantNumeric="tabular-nums"
      // The input keeps its own width otherwise, too wide for half of the dialog.
      minW="0"
      // A tap brings up the calendar alone, not the on-screen keyboard as well. A real keyboard can
      // still type a day.
      inputProps={{ ...ariaProps, minW: "0", inputMode: "none" }}
      {...props}
    />
  );
}

/**
 * A date field of the form: a day typed in, or picked from the calendar that opens when the field
 * is tapped. Focusing or typing does not open the calendar, so moving the focus to an error does
 * not cover the form with it.
 */
function DateField({
  form,
  name,
  label,
}: {
  form: FormStore<CampaignFormSchema>;
  name: "date" | "start" | "end";
  label: string;
}) {
  return (
    <FormField of={form} path={[name]}>
      {(field) => (
        <Field.Root label={label} {...errorsOf(field)} minW="0">
          <FieldDatePicker
            ref={field.props.ref}
            name={field.props.name}
            value={parseIsoDate(field.input)}
            onChange={(date) => setInput(form, { path: [name], input: date ? isoDate(date) : "" })}
            onBlur={field.props.onBlur}
          />
        </Field.Root>
      )}
    </FormField>
  );
}

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
  const [choice, setChoice] = useState(defaultRate === 2 ? 2 : 1);
  const form = useForm({
    schema: campaignFormSchema(spec),
    initialInput: {
      label: defaults.label,
      date: plan.period.start,
      start: plan.period.start,
      end: plan.period.end,
      rate: String(defaultRate),
      minOrderAmount: grouped(defaults.conditions.minOrderAmount ?? 3980),
      cap: grouped(defaults.params.cap),
    },
  });
  const [failed, setFailed] = useState(false);
  const formId = useId();
  const duplicateId = useId();

  const date = useField(form, { path: ["date"] }).input;
  const start = useField(form, { path: ["start"] }).input;
  const end = useField(form, { path: ["end"] }).input;
  const occurrence = spec.date
    ? { dates: isDate(date) ? [date] : [] }
    : { period: isDate(start) && isDate(end) ? { start, end } : undefined };
  const duplicate = hasCampaignOccurrence(plan, template, occurrence);
  const imagePath = spec.date
    ? SPORTS_CHOICES.find((option) => option.rate === choice)?.imagePath
    : template.benefit.imagePath;

  const submit = async (output: v.InferOutput<CampaignFormSchema>) => {
    if (duplicate) return;
    const benefit = instantiateCampaign(template, {
      id: crypto.randomUUID(),
      ...(spec.date ? { dates: [output.date], rate: choice } : {}),
      ...(spec.period ? { period: { start: output.start, end: output.end } } : {}),
      ...(spec.rate ? { rate: output.rate } : {}),
      ...(spec.cap && output.cap !== undefined ? { cap: output.cap } : {}),
      ...(spec.minOrderAmount ? { minOrderAmount: output.minOrderAmount } : {}),
      ...(spec.label && output.label !== "" ? { label: output.label } : {}),
    });
    setFailed(false);
    try {
      await addBenefit({ planId: plan.id, benefit });
      onClose();
    } catch {
      setFailed(true);
    }
  };

  return (
    <>
      <Modal.Header>
        <HStack gap="3">
          {imagePath ? (
            <Image
              src={imageUrl(imagePath)}
              alt=""
              boxSize="12"
              objectFit="contain"
              flexShrink="0"
            />
          ) : null}
          <Modal.Title as="h2">{template.name}を追加</Modal.Title>
        </HStack>
      </Modal.Header>
      <Modal.Body alignItems="stretch">
        <Form of={form} id={formId} onSubmit={submit}>
          <VStack gap="3" alignItems="stretch">
            {spec.label ? <TextField form={form} name="label" label="名前" /> : null}
            {spec.date ? (
              <>
                <DateField form={form} name="date" label="日付" />
                <RadioCardGroup.Root
                  aria-label="倍率"
                  value={String(choice)}
                  onChange={(value) => setChoice(Number(value))}
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
                      <Image
                        src={imageUrl(option.imagePath)}
                        alt=""
                        boxSize="16"
                        objectFit="contain"
                      />
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
              <Box
                display="grid"
                gridTemplateColumns="repeat(2, minmax(0, 1fr))"
                alignItems="start"
                gap="2"
              >
                <DateField form={form} name="start" label="開始日" />
                <DateField form={form} name="end" label="終了日" />
              </Box>
            ) : null}
            {spec.rate ? (
              <TextField form={form} name="rate" label="倍率（+N倍）" inputMode="decimal" />
            ) : null}
            {spec.minOrderAmount ? (
              <TextField
                form={form}
                name="minOrderAmount"
                label="条件金額（円）"
                inputMode="numeric"
              />
            ) : null}
            {spec.cap ? (
              <TextField
                form={form}
                name="cap"
                label={spec.cap === "required" ? "獲得上限（P）" : "獲得上限（P・任意）"}
                inputMode="numeric"
              />
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
        </Form>
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
          loading={form.isSubmitting}
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
      // Focusing the first field would open its calendar before the user knows what the dialog is.
      autoFocus={false}
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
