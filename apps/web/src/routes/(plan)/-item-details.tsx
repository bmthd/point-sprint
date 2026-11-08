// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { Field as FormField, FieldArray, insert, remove } from "@formisch/react";
import { Box, Button, Field, Fieldset, Flex, Input, NativeSelect, Text } from "@workspaces/ui";
import { type FieldState, bind, errorsOf } from "#/routes/-form.tsx";
import { emptyItem } from "./-order-form";
import type { OrderForm } from "./-order-form-store";
import { TaxRateOptions } from "./-order-fields";

// The fields of 「詳細設定」, the same in the phone's sheet and in the desktop list.

/** `lg` in the desktop list, whose controls are all 44px. */
type Size = "lg" | undefined;

/** A label on the left and a short field on the right, the error under both. */
function InlineField({
  label,
  field,
  inputMode,
  placeholder,
  size,
}: {
  label: string;
  field: FieldState;
  inputMode: "numeric" | "decimal";
  placeholder?: string;
  size?: Size;
}) {
  return (
    <Field.Root
      label={label}
      {...errorsOf(field)}
      display="grid"
      gridTemplateColumns="minmax(0, 1fr) auto"
      alignItems="center"
      columnGap="3"
      errorMessageProps={{ gridColumn: "1 / -1" }}
    >
      <Input
        size={size}
        w="24"
        textAlign="end"
        fontVariantNumeric="tabular-nums"
        inputMode={inputMode}
        placeholder={placeholder}
        {...bind(field)}
      />
    </Field.Root>
  );
}

/** Quantity, coupon and the shop's own rate of one item. */
export function ItemDetailFields({
  form,
  index,
  withRate = true,
  size,
}: {
  form: OrderForm;
  index: number;
  size?: Size;
  /** The first item's rate is next to its amount, so it is left out here. */
  withRate?: boolean;
}) {
  return (
    <>
      <FormField of={form} path={["items", index, "quantity"]}>
        {(field) => <InlineField label="数量" field={field} inputMode="numeric" size={size} />}
      </FormField>
      <FormField of={form} path={["items", index, "discount"]}>
        {(field) => (
          <InlineField
            label="クーポン値引額（税込）"
            field={field}
            inputMode="numeric"
            placeholder="0"
            size={size}
          />
        )}
      </FormField>
      {withRate ? (
        <FormField of={form} path={["items", index, "shopPointRate"]}>
          {(field) => (
            <InlineField
              label="ショップ独自倍率"
              field={field}
              inputMode="decimal"
              placeholder="1"
              size={size}
            />
          )}
        </FormField>
      ) : null}
    </>
  );
}

/** An item after the first one, added with 「同じショップの商品を追加」. */
function ExtraItem({
  form,
  index,
  onRemove,
  size,
}: {
  form: OrderForm;
  index: number;
  onRemove?: () => void;
  size?: Size;
}) {
  const label = `商品${index + 1}`;
  return (
    <Fieldset.Root legend={label} variant="outline" size="sm">
      <FormField of={form} path={["items", index, "name"]}>
        {(field) => (
          <Field.Root label="商品名" {...errorsOf(field)}>
            <Input size={size} {...bind(field)} />
          </Field.Root>
        )}
      </FormField>
      <Box
        display="grid"
        gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)"
        alignItems="start"
        gap="2"
      >
        <FormField of={form} path={["items", index, "unitPrice"]}>
          {(field) => (
            <Field.Root label="金額（税込）" {...errorsOf(field)}>
              <Input
                size={size}
                textAlign="end"
                fontVariantNumeric="tabular-nums"
                inputMode="numeric"
                {...bind(field)}
              />
            </Field.Root>
          )}
        </FormField>
        <FormField of={form} path={["items", index, "taxRate"]}>
          {(field) => (
            <Field.Root label="税率" invalid={field.errors !== null}>
              <NativeSelect.Root size={size} {...bind(field)}>
                <TaxRateOptions />
              </NativeSelect.Root>
            </Field.Root>
          )}
        </FormField>
      </Box>
      <ItemDetailFields form={form} index={index} size={size} />
      <Button
        type="button"
        size={size}
        variant="outline"
        colorScheme="danger"
        alignSelf="flex-start"
        onClick={() => {
          remove(form, { path: ["items"], at: index });
          onRemove?.();
        }}
      >
        {label}を削除
      </Button>
    </Fieldset.Root>
  );
}

/** The items after the first one, and 「＋ 同じショップの商品を追加」. `onRemove` runs once one is gone. */
export function ExtraItems({
  form,
  onRemove,
  size,
}: {
  form: OrderForm;
  onRemove?: () => void;
  size?: Size;
}) {
  return (
    <>
      <FieldArray of={form} path={["items"]}>
        {(items) => (
          <Flex direction="column" gap="2">
            {items.items.map((key, index) =>
              index === 0 ? null : (
                <ExtraItem key={key} form={form} index={index} onRemove={onRemove} size={size} />
              ),
            )}
            {items.errors ? (
              <Text role="alert" fontSize="sm" color="danger.fg">
                {items.errors[0]}
              </Text>
            ) : null}
          </Flex>
        )}
      </FieldArray>
      <Button
        type="button"
        size={size}
        variant="ghost"
        colorScheme="primary"
        alignSelf="flex-start"
        onClick={() => insert(form, { path: ["items"], initialInput: emptyItem() })}
      >
        ＋ 同じショップの商品を追加
      </Button>
    </>
  );
}
