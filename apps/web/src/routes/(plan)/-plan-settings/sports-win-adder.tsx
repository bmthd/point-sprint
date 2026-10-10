// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import {
  Field as FormField,
  FieldArray,
  getInput,
  insert,
  remove,
  reset,
  setErrors,
  useForm,
} from "@formisch/react";
import {
  type Benefit,
  type CampaignTemplate,
  type Plan,
  hasCampaignOccurrence,
  instantiateCampaign,
} from "@workspaces/domain";
import { Box, Button, Field, Fieldset, Flex, IconButton, NativeSelect, Text } from "@workspaces/ui";
import { useSetAtom } from "jotai";
import * as v from "valibot";
import { dateSchema } from "../../../form/field-schemas";
import { Form, bind, errorsOf } from "../../../form/form";
import { addBenefitsAtom } from "../../../state/order-ops";
import { CloseIcon } from "../../../ui/icons";
import { FormDatePicker } from "../-date-picker-field";
import { daysOf } from "./campaign-adder";
import { useSaveSettingsChange } from "./settings-shared";

const RATES = ["1", "2"] as const;

const RowsSchema = v.object({
  occurrences: v.pipe(
    v.array(v.object({ date: dateSchema("開催日"), rate: v.picklist(["1", "2"]) })),
    v.minLength(1, "開催日を1つ以上入れてください"),
    v.check(
      (rows) => new Set(rows.map((row) => row.date)).size === rows.length,
      "同じ開催日が2回入っています",
    ),
  ),
});

/**
 * The first day of the plan after `after` (wrapping to its start) that the plan does not have the
 * campaign for and that is not in `picked`. An empty text when every day is taken.
 */
function nextFreeDay(
  plan: Plan,
  template: CampaignTemplate,
  after: string,
  picked: string[],
): string {
  const days = daysOf(plan.period);
  const ordered = [...days.filter((day) => day > after), ...days.filter((day) => day <= after)];
  return (
    ordered.find(
      (day) => !picked.includes(day) && !hasCampaignOccurrence(plan, template, { dates: [day] }),
    ) ?? ""
  );
}

const row = (date: string) => ({ date, rate: "1" as const });

/**
 * Adds more occurrences of 勝ったら倍 at once: a day and +1 / +2 for each, one campaign for each
 * occurrence. It starts with the first free day after the campaign being edited.
 */
export function SportsWinAdder({
  plan,
  benefit,
  template,
}: {
  plan: Plan;
  benefit: Benefit;
  template: CampaignTemplate;
}) {
  const addBenefits = useSetAtom(addBenefitsAtom);
  const save = useSaveSettingsChange(plan.id);
  const ownDate =
    benefit.conditions.dateRule?.type === "dates"
      ? benefit.conditions.dateRule.dates[0]
      : undefined;
  const form = useForm({
    schema: RowsSchema,
    initialInput: {
      occurrences: [row(nextFreeDay(plan, template, ownDate ?? plan.period.start, []))],
    },
    validate: "submit",
    revalidate: "input",
  });

  const pickedDays = () =>
    (getInput(form, { path: ["occurrences"] }) ?? []).flatMap((occurrence) =>
      typeof occurrence?.date === "string" && occurrence.date !== "" ? [occurrence.date] : [],
    );

  return (
    <Form
      of={form}
      onSubmit={({ occurrences }) => {
        // The plan changes after the form is made, so the days are checked against it here.
        const taken = occurrences.flatMap((occurrence, index) =>
          hasCampaignOccurrence(plan, template, { dates: [occurrence.date] }) ? [index] : [],
        );
        for (const index of taken) {
          setErrors(form, {
            path: ["occurrences", index, "date"],
            errors: [`この日の${template.name}はもう追加してあります`],
          });
        }
        if (taken.length > 0) return;
        const benefits = occurrences.map((occurrence) =>
          instantiateCampaign(template, {
            id: crypto.randomUUID(),
            dates: [occurrence.date],
            rate: Number(occurrence.rate),
          }),
        );
        save(addBenefits({ planId: plan.id, benefits }));
        const added = occurrences.map((occurrence) => occurrence.date);
        const last = added.toSorted().at(-1) ?? plan.period.start;
        reset(form, {
          initialInput: { occurrences: [row(nextFreeDay(plan, template, last, added))] },
        });
      }}
    >
      <Fieldset.Root legend="ほかの開催をまとめて追加" variant="outline" size="sm">
        <Text fontSize="xs" color="fg.muted">
          倍率は、片方のチームが勝った日が +1倍、両方のチームが勝った日が
          +2倍です。開催ごとに上限があるので、開催 1 回ずつに分けて追加します。
        </Text>
        <FieldArray of={form} path={["occurrences"]}>
          {(rows) => (
            <Flex direction="column" gap="2">
              {rows.items.map((key, index) => (
                <Box
                  key={key}
                  display="grid"
                  gridTemplateColumns="minmax(0, 1fr) auto"
                  alignItems="end"
                  gap="1.5"
                >
                  <FormField of={form} path={["occurrences", index, "date"]}>
                    {(field) => (
                      <Field.Root
                        label={`${index + 1}件目の開催日`}
                        {...errorsOf(field)}
                        gridColumn="1 / -1"
                      >
                        <FormDatePicker field={field} period={plan.period} clearable={false} />
                      </Field.Root>
                    )}
                  </FormField>
                  <FormField of={form} path={["occurrences", index, "rate"]}>
                    {(field) => (
                      <Field.Root label={`${index + 1}件目の倍率`}>
                        <NativeSelect.Root {...bind(field)}>
                          {RATES.map((rate) => (
                            <option key={rate} value={rate}>
                              +{rate}倍
                            </option>
                          ))}
                        </NativeSelect.Root>
                      </Field.Root>
                    )}
                  </FormField>
                  <IconButton
                    type="button"
                    variant="ghost"
                    colorScheme="danger"
                    disabled={rows.items.length === 1}
                    aria-label={`${index + 1}件目を外す`}
                    icon={<CloseIcon />}
                    onClick={() => remove(form, { path: ["occurrences"], at: index })}
                  />
                </Box>
              ))}
              {rows.errors ? (
                <Text role="alert" fontSize="sm" color="danger.fg">
                  {rows.errors[0]}
                </Text>
              ) : null}
            </Flex>
          )}
        </FieldArray>
        <Flex gap="2" wrap="wrap">
          <Button
            type="button"
            variant="ghost"
            colorScheme="primary"
            onClick={() => {
              const picked = pickedDays();
              const last = picked.toSorted().at(-1) ?? ownDate ?? plan.period.start;
              insert(form, {
                path: ["occurrences"],
                initialInput: row(
                  nextFreeDay(plan, template, last, [...picked, ...(ownDate ? [ownDate] : [])]),
                ),
              });
            }}
          >
            ＋ 開催日を足す
          </Button>
          <Button type="submit" variant="outline" colorScheme="primary">
            まとめて追加
          </Button>
        </Flex>
      </Fieldset.Root>
    </Form>
  );
}
