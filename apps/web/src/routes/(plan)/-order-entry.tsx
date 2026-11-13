// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { Field as FormField, focus, setInput, useField } from "@formisch/react";
import { type Plan, channels } from "@workspaces/domain";
import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Input,
  InputGroup,
  NativeAccordion,
  SegmentedControl,
  Text,
} from "@workspaces/ui";
import { useAtom, useAtomValue } from "jotai";
import { type ClipboardEvent, type ReactNode, type Ref, useId, useState } from "react";
import { bind, errorsOf } from "#/routes/-form.tsx";
import { shopsAtom } from "#/state/queries.ts";
import { type EntryMode, entryModeAtom } from "./-ui.ts";
import { FormDatePicker } from "./-date-picker-field.tsx";
import { AutofillStatus, type ItemAutofill } from "./-item-autofill.tsx";
import {
  ChannelField,
  ShopRateInput,
  TaxRateButtons,
  optionalMark,
  shopFromUrl,
} from "./-order-fields.tsx";
import {
  AMOUNT_PATH,
  type OrderForm,
  applyShop,
  autofillUrlHandlers,
  urlFromPastedText,
} from "./-order-form-store.ts";
import { taxRateSegmentsStyle } from "./-order-shared.tsx";
import { ShopAutocomplete } from "./-shop-autocomplete.tsx";

// The parts of an order's form that the desktop list and the phone's sheet share: whether the
// order is entered by its amount or by its item's URL, the large amount field, and 「条件」, which
// holds every field that has a value to start from.

type Size = "lg" | undefined;

/**
 * How the order is entered. A new order starts the way the last one was entered on this device;
 * an order being edited starts by its URL when it has one, and its way is not remembered.
 */
export function useEntryMode(remember: boolean, initial: EntryMode = "amount") {
  const [remembered, setRemembered] = useAtom(entryModeAtom);
  const [own, setOwn] = useState(initial);
  return remember ? ([remembered, setRemembered] as const) : ([own, setOwn] as const);
}

/** The field to put the focus on first for a way of entering the order. */
function firstFieldOf(mode: EntryMode) {
  return mode === "url" ? (["url"] as const) : AMOUNT_PATH;
}

/** Puts the focus on the first field of `mode`, once the fields of that way are in place. */
export function focusFirstField(form: OrderForm, mode: EntryMode) {
  requestAnimationFrame(() => focus(form, { path: firstFieldOf(mode) }));
}

/** 「金額で入れる」 or 「URLで入れる」 above the fields of a new order. */
export function EntryModeSwitch({
  mode,
  onChange,
  fill = false,
}: {
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
  /** Whether the two choices share the row's width. */
  fill?: boolean;
}) {
  return (
    <SegmentedControl.Root
      aria-label="入れ方"
      size="lg"
      // Each choice is pressed 44px, as a tax rate's is.
      css={{ "& label::before": taxRateSegmentsStyle.css["& label::before"] }}
      // As wide as its choices, or the row's width. Its large size is otherwise at least 24rem
      // wide, wider than a phone's sheet, and narrower widths leave the chosen one's mark behind.
      w={fill ? "full" : "auto"}
      alignSelf={fill ? "stretch" : "flex-start"}
      minW="0"
      maxW="full"
      items={[
        { label: "金額で入れる", value: "amount" },
        { label: "URLで入れる", value: "url" },
      ]}
      value={mode}
      onChange={(value) => onChange(value as EntryMode)}
    />
  );
}

/**
 * Puts a URL in the URL field as a paste would: its shop is chosen at once, and its item is looked
 * up.
 */
export function useEnterUrl(form: OrderForm, autofill: ItemAutofill) {
  const shops = useAtomValue(shopsAtom);
  return (text: string) => {
    setInput(form, { path: ["url"], input: text });
    const found = shopFromUrl(text, shops);
    if (found) applyShop(form, found);
    autofill.onUrlChange(text, true);
  };
}

const looksLikeUrl = (text: string) => /^\s*https?:\/\//i.test(text);

/**
 * The order's amount, the one field every order needs, larger than the rest. `aside` (the points
 * the order gets) sits on its right where there is room, else under it. A URL pasted into it goes
 * to `onUrlPasted` instead.
 */
export function AmountField({
  form,
  aside,
  onUrlPasted,
  inputRef,
}: {
  form: OrderForm;
  aside?: ReactNode;
  onUrlPasted: (url: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!looksLikeUrl(text)) return;
    event.preventDefault();
    onUrlPasted(urlFromPastedText(text.trim()));
  };

  return (
    <Flex wrap="wrap" gap="3" align="stretch">
      <Box flex="1 1 16rem" minW="0">
        <FormField of={form} path={AMOUNT_PATH}>
          {(field) => (
            <Field.Root
              label={
                <>
                  金額（税込）
                  {/* Said by aria-required instead: the input's name is 「金額（税込）」 alone. */}
                  <Badge
                    aria-hidden="true"
                    variant="solid"
                    colorScheme="primary"
                    size="sm"
                    ms="1.5"
                  >
                    必須
                  </Badge>
                </>
              }
              labelProps={{ fontWeight: "bold" }}
              {...errorsOf(field)}
              minW="0"
            >
              <InputGroup.Root size="2xl">
                <InputGroup.Addon aria-hidden="true" fontSize="xl">
                  ¥
                </InputGroup.Addon>
                <Input
                  {...bind(field)}
                  ref={(element: HTMLInputElement | null) => {
                    field.props.ref(element);
                    if (typeof inputRef === "function") inputRef(element);
                    else if (inputRef) inputRef.current = element;
                  }}
                  aria-label="金額（税込）"
                  aria-required="true"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  textAlign="end"
                  fontSize="3xl"
                  fontWeight="bold"
                  fontVariantNumeric="tabular-nums"
                  borderWidth="2px"
                  borderColor={field.errors ? undefined : "primary.solid"}
                  onPaste={onPaste}
                />
              </InputGroup.Root>
            </Field.Root>
          )}
        </FormField>
      </Box>
      {aside ? (
        <Flex flex="1 1 12rem" minW="0" direction="column" justify="flex-end">
          {aside}
        </Flex>
      ) : null}
    </Flex>
  );
}

/**
 * The item's URL, looked up to fill in the order. `withPaste` adds 「貼り付け」, which reads the
 * clipboard, for a phone, where pasting into a field takes a long press.
 */
export function UrlField({
  form,
  autofill,
  size,
  withPaste = false,
}: {
  form: OrderForm;
  autofill: ItemAutofill;
  size?: Size;
  withPaste?: boolean;
}) {
  const shops = useAtomValue(shopsAtom);
  const url = useField(form, { path: ["url"] });
  const enterUrl = useEnterUrl(form, autofill);
  const hintId = useId();
  const inputId = useId();
  const text = typeof url.input === "string" ? url.input.trim() : "";
  // Not an error: the order can still be saved with a URL no shop is chosen from.
  const unknown = url.errors === null && text !== "" && shopFromUrl(text, shops) === null;

  // The shop of the URL is chosen at once, and stays when the item cannot be looked up.
  const onUrl = (value: string) => {
    url.onChange(value);
    const found = shopFromUrl(value, shops);
    if (found) applyShop(form, found);
  };

  const paste = async () => {
    try {
      enterUrl(urlFromPastedText(await navigator.clipboard.readText()));
    } catch {
      // Reading the clipboard was not allowed; the URL can still be pasted into the field.
      document.getElementById(inputId)?.focus();
    }
  };

  return (
    <Field.Root
      label="商品ページのURL"
      {...errorsOf(url)}
      helperMessage={
        unknown
          ? "このURLからはショップを選べません"
          : text === ""
            ? "楽天市場の商品ページなら、ショップ・商品名・金額・独自倍率を読み込みます"
            : undefined
      }
      helperMessageProps={{ id: hintId }}
      // The field gives its id to the input, which 「貼り付け」 focuses when it cannot paste.
      id={inputId}
      minW="0"
    >
      <Flex gap="2">
        <Input
          {...bind(url)}
          size={size}
          flex="1"
          minW="0"
          type="url"
          inputMode="url"
          placeholder="https://item.rakuten.co.jp/…"
          // Field links a helper message only when the field's invalid state changes, and this
          // one comes and goes while the field stays valid.
          {...(url.errors === null ? { "aria-describedby": hintId } : {})}
          {...autofillUrlHandlers(autofill, onUrl, url.props.onBlur)}
        />
        {withPaste ? (
          <Button
            type="button"
            variant="outline"
            size={size}
            flex="none"
            onClick={() => void paste()}
          >
            貼り付け
          </Button>
        ) : null}
      </Flex>
      <AutofillStatus autofill={autofill} />
    </Field.Root>
  );
}

/** The shop and the first item's name, side by side where there is room. */
export function ShopAndName({ form, size }: { form: OrderForm; size?: Size }) {
  return (
    <Box
      display="grid"
      gridTemplateColumns="repeat(auto-fit, minmax(13rem, 1fr))"
      alignItems="start"
      gap="2.5"
    >
      <ShopAutocomplete form={form} size={size} />
      <FormField of={form} path={["items", 0, "name"]}>
        {(field) => (
          <Field.Root label="商品名" optionalIndicator={optionalMark} {...errorsOf(field)} minW="0">
            <Input size={size} placeholder="例：洗濯洗剤" {...bind(field)} />
          </Field.Root>
        )}
      </FormField>
    </Box>
  );
}

const CAMPAIGN_NAMES = {
  is39: "39ショップ",
  repeat: "リピート購入",
  brandDay: "ブランドデー",
  is24h: "24時間限定",
} as const;

/** `2026-11-13` as 「11/13」. */
const monthDay = (date: string) => {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${Number(match[1])}/${Number(match[2])}` : date;
};

/**
 * What 「条件」 holds, on one line: where and when, the tax rate, and, in the primary color, every
 * value that is not the one a new order starts from.
 */
function ConditionsSummary({ form }: { form: OrderForm }) {
  const shops = useAtomValue(shopsAtom);
  const shop = useField(form, { path: ["shop"] });
  const channel = useField(form, { path: ["channel"] });
  const date = useField(form, { path: ["date"] });
  const taxRate = useField(form, { path: ["items", 0, "taxRate"] });
  const rate = useField(form, { path: ["items", 0, "shopPointRate"] });
  const quantity = useField(form, { path: ["items", 0, "quantity"] });
  const discount = useField(form, { path: ["items", 0, "discount"] });
  const items = useField(form, { path: ["items"] });
  const onHold = useField(form, { path: ["onHold"] });
  const tags = {
    is39: useField(form, { path: ["is39"] }).input === true,
    repeat: useField(form, { path: ["repeat"] }).input === true,
    brandDay: useField(form, { path: ["brandDay"] }).input === true,
    is24h: useField(form, { path: ["is24h"] }).input === true,
  };

  // A saved shop is on one channel, which the field shows.
  const saved = shops.find((other) => other.id === shop.input);
  const channelId = saved?.channel ?? channel.input;
  const channelLabel =
    typeof channelId === "string" && channelId in channels
      ? channels[channelId as keyof typeof channels].label
      : "";
  const tax = taxRate.input === "0.08" ? "税8%" : taxRate.input === "0" ? "非課税" : "税10%";
  const rateText = typeof rate.input === "string" ? rate.input.trim() : "";
  const count = Array.isArray(items.input) ? items.input.length : 1;
  const quantityText = typeof quantity.input === "string" ? quantity.input.trim() : "";
  const discountText = typeof discount.input === "string" ? discount.input.trim() : "";

  const changed = [
    ...(taxRate.input !== "0.1" ? [tax] : []),
    ...(rateText !== "" && Number(rateText) !== 1 ? [`独自${rateText}倍`] : []),
    ...(Object.keys(CAMPAIGN_NAMES) as (keyof typeof CAMPAIGN_NAMES)[])
      .filter((key) => tags[key])
      .map((key) => CAMPAIGN_NAMES[key]),
    ...(quantityText !== "" && quantityText !== "1" ? [`数量${quantityText}`] : []),
    ...(discountText !== "" && discountText !== "0" ? ["クーポン"] : []),
    ...(count > 1 ? [`商品${count}点`] : []),
    ...(onHold.input === true ? ["保留"] : []),
  ];
  const plain = [
    channelLabel,
    monthDay(typeof date.input === "string" ? date.input : ""),
    ...(taxRate.input === "0.1" ? [tax] : []),
  ].filter((text) => text !== "");

  return (
    <Flex as="span" wrap="wrap" columnGap="2" rowGap="0.5" minW="0" fontSize="sm">
      {plain.map((text) => (
        <Text as="span" key={text} color="fg.muted">
          {text}
        </Text>
      ))}
      {changed.map((text) => (
        <Text as="span" key={text} color="primary.fg" fontWeight="bold">
          {text}
        </Text>
      ))}
    </Flex>
  );
}

/**
 * 「条件」: the fields that have a value to start from, shut under a line that sums them up.
 * `campaigns` are the order's campaign checks; `children` go last (quantity, coupon and the like).
 * Shut, its fields stay in the form.
 */
export function Conditions({
  form,
  plan,
  size,
  defaultOpen = false,
  campaigns,
  children,
}: {
  form: OrderForm;
  plan: Plan;
  size?: Size;
  defaultOpen?: boolean;
  campaigns: ReactNode;
  children?: ReactNode;
}) {
  return (
    // The animated panel clips its content, which cuts the focus rings at its edges.
    <NativeAccordion.Root animate={false}>
      <NativeAccordion.Item open={defaultOpen} borderWidth="0">
        <NativeAccordion.Button
          minH="11"
          px="3"
          py="2"
          gap="3"
          rounded="l2"
          bg="bg.subtle"
          _open={{ roundedBottom: "0" }}
        >
          <Text as="span" fontSize="sm" fontWeight="bold" flex="none">
            条件
          </Text>
          <Box as="span" flex="1" minW="0" textAlign="start">
            <ConditionsSummary form={form} />
          </Box>
        </NativeAccordion.Button>
        <NativeAccordion.Panel
          px="3"
          pt="3"
          pb="3"
          borderWidth="1px"
          borderTopWidth="0"
          roundedBottom="l2"
        >
          <Flex direction="column" gap="3.5">
            <Box
              display="grid"
              gridTemplateColumns="repeat(auto-fit, minmax(10rem, 1fr))"
              alignItems="start"
              gap="2.5"
            >
              <ChannelField form={form} size={size} />
              <FormField of={form} path={["date"]}>
                {(field) => (
                  <Field.Root label="注文日" {...errorsOf(field)} minW="0">
                    <FormDatePicker size={size} field={field} period={plan.period} />
                  </Field.Root>
                )}
              </FormField>
            </Box>
            <Box
              display="grid"
              gridTemplateColumns="repeat(auto-fit, minmax(10rem, 1fr))"
              alignItems="start"
              gap="2.5"
            >
              <FormField of={form} path={["items", 0, "taxRate"]}>
                {(field) => <TaxRateButtons field={field} size={size} fill />}
              </FormField>
              <FormField of={form} path={["items", 0, "shopPointRate"]}>
                {(field) => <ShopRateInput field={field} size={size} />}
              </FormField>
            </Box>
            {campaigns}
            {children}
          </Flex>
        </NativeAccordion.Panel>
      </NativeAccordion.Item>
    </NativeAccordion.Root>
  );
}
