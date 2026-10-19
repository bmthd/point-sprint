// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { Field as FormField, useField } from "@formisch/react";
import {
  type ChannelId,
  type OrderTag,
  type Shop,
  type ShopTag,
  campaignTemplates,
  channels,
  parseUrl,
} from "@workspaces/domain";
import {
  Badge,
  CheckboxCard,
  CircleQuestionMarkIcon,
  Fieldset,
  Flex,
  IconButton,
  Image,
  InputGroup,
  NativeSelect,
  NumberInput,
  SegmentedControl,
  Text,
  Tooltip,
  Field as UIField,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { type ReactNode, useId, useMemo } from "react";
import { type FieldState, bind, errorsOf } from "../../form/form";
import { type ShopChange, changeShop, replaceShop } from "../../state/mutations";
import { shopsAtom } from "../../state/queries";
import type { RakutenItem } from "../../rakuten/item-search";
import { imageUrl, taxRateLabel, taxRateSegmentsStyle } from "./-order-shared";
import type { OrderForm } from "./-order-editor/order-form-store";

// Fields shared by the desktop list's edit grid, its add form and the order editor.

export const NEW_SHOP = "new";
export const TAX_RATES = ["0.1", "0.08", "0"] as const;
export type TaxRateValue = (typeof TAX_RATES)[number];

export const taxRateValue = (rate: number): TaxRateValue =>
  rate === 0.08 ? "0.08" : rate === 0 ? "0" : "0.1";

/**
 * The grid that wraps the fields by the width available. Its fields keep their own height: a
 * field stretched to the height of an error beside it spreads its label and input apart.
 */
export const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  alignItems: "start",
  gap: "2.5",
} as const;

export const input = {
  h: "11",
  w: "full",
  minW: "0",
  px: "2.5",
  rounded: "lg",
  borderWidth: "1px",
  borderColor: "border.emphasized",
  bg: "bg.panel",
  color: "fg",
  fontSize: "sm",
  _invalid: { borderColor: "danger.outline" },
} as const;

/**
 * A label above its field, and the field's error under it. The field inside gets its id from the
 * label, and `aria-invalid` and `aria-describedby` while there is an error.
 */
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <UIField.Root label={label} invalid={error !== undefined} errorMessage={error} minW="0">
      {children}
    </UIField.Root>
  );
}

/** A value that cannot be edited here, shown in place of its field. */
export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const labelId = useId();
  return (
    <Flex direction="column" gap="1" minW="0">
      <Text id={labelId} fontSize="xs" color="fg.muted">
        {label}
      </Text>
      <Text
        aria-labelledby={labelId}
        role="group"
        h="11"
        display="flex"
        alignItems="center"
        fontSize="sm"
        fontVariantNumeric="tabular-nums"
      >
        {value}
      </Text>
    </Flex>
  );
}

export function useSortedShops(shops: Shop[]) {
  return useMemo(() => [...shops].sort((a, b) => a.name.localeCompare(b.name, "ja")), [shops]);
}

const TAX_LABELS: Record<TaxRateValue, string> = {
  "0.1": "10%",
  "0.08": "8%（食品）",
  "0": "非課税",
};

/** Where the order was bought: the shop's own when a saved shop is chosen, else the order's. */
export function ChannelField({ form, size }: { form: OrderForm; size?: "lg" }) {
  const shops = useAtomValue(shopsAtom);
  const shop = useField(form, { path: ["shop"] });
  const saved = shops.find((other) => other.id === shop.input);
  return (
    <FormField of={form} path={["channel"]}>
      {(field) => (
        <UIField.Root label="購入先" {...errorsOf(field)} minW="0">
          <NativeSelect.Root
            size={size}
            {...bind(field)}
            // A saved shop is on one channel, so the field shows it and stays as it is.
            {...(saved ? { value: saved.channel, disabled: true } : {})}
          >
            {Object.values(channels).map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.label}
              </option>
            ))}
          </NativeSelect.Root>
        </UIField.Root>
      )}
    </FormField>
  );
}

/** One part of the order's fields under its small heading. */
export function OrderPart({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <Fieldset.Root legend={legend} size="sm" minW="0" gap="2" legendProps={{ color: "fg.muted" }}>
      {children}
    </Fieldset.Root>
  );
}

/** A Formisch field that is set by a value, not by an input's event. */
type ValueField<T = string> = FieldState & { onChange: (value: T) => void };

/**
 * Pressed in a 44px square around a control drawn smaller, or taller where it is wider: a
 * pseudo-element from inside its border reaches the rest. Percentages here are of the control's
 * own box, so any size gets 44px.
 */
const TAP_44 = {
  position: "relative",
  overflow: "visible",
  _before: { content: '""', position: "absolute", inset: "min(0px, calc((100% - 44px) / 2))" },
} as const;

/** The item's tax rate: three choices of one width on a gray track, the chosen one raised. */
export function TaxRateButtons({
  field,
  size,
  fill = false,
}: {
  field: ValueField<TaxRateValue>;
  size?: "lg";
  /** Whether the choices share the row's width, or keep the width of the longest label. */
  fill?: boolean;
}) {
  return (
    // Its legend sits above the choices as a field's label does above its input.
    <Fieldset.Root legend="税率" minW="0" gap="1" legendProps={{ fontSize: "sm" }}>
      <SegmentedControl.Root
        size={size}
        w={fill ? "full" : "xs"}
        items={TAX_RATES.map((rate) => ({ label: TAX_LABELS[rate], value: rate }))}
        value={typeof field.input === "string" ? (field.input as TaxRateValue) : undefined}
        onChange={(value) => field.onChange(value as TaxRateValue)}
        {...taxRateSegmentsStyle}
      />
    </Fieldset.Root>
  );
}

/** Beside the label of a field the order can be saved without. */
export const optionalMark = (
  <Badge variant="outline" colorScheme="gray" size="sm" fontWeight="normal" ms="1.5">
    任意
  </Badge>
);

/** What the URL field does, shown when its ? is pointed at or pressed. */
const URL_HELP =
  "URLで楽天のAPIに問い合わせて商品情報を自動入力します。入力項目は、ショップ・商品名・金額・ショップ独自倍率です。楽天ブックス・楽天KoboのURLは、問い合わせずにショップだけ選びます。";

/** The URL field's label, with its ? that explains what it fills in. */
export function UrlLabel() {
  return (
    <>
      URLから自動入力
      <Tooltip content={URL_HELP}>
        <IconButton
          variant="ghost"
          size="xs"
          colorScheme="gray"
          ms="0.5"
          {...TAP_44}
          aria-label="詳しく"
          icon={<CircleQuestionMarkIcon />}
        />
      </Tooltip>
    </>
  );
}

/** The item's shop rate, stepped up and down by 1 with the buttons or the arrow keys. */
export function ShopRateInput({ field, size }: { field: ValueField; size?: "lg" }) {
  const { name, ref, onBlur } = field.props;
  return (
    <UIField.Root label="独自倍率" optionalIndicator={optionalMark} {...errorsOf(field)} minW="0">
      {/* The rate is on the price before tax, as Rakuten's shop rates are: 倍, not %. */}
      <InputGroup.Root size={size}>
        <NumberInput
          rootProps={{ flex: "1", minW: "0" }}
          min={0}
          step={1}
          placeholder="1"
          inputMode="decimal"
          textAlign="end"
          fontVariantNumeric="tabular-nums"
          name={name}
          ref={ref}
          onBlur={onBlur}
          value={typeof field.input === "string" ? field.input : ""}
          onChange={(value) => field.onChange(value)}
        />
        <InputGroup.Addon aria-hidden="true">倍</InputGroup.Addon>
      </InputGroup.Root>
    </UIField.Root>
  );
}

export function TaxRateOptions() {
  return TAX_RATES.map((rate) => (
    <option key={rate} value={rate}>
      {taxRateLabel(Number(rate))}
    </option>
  ));
}

const campaignImage = (id: "39shop" | OrderTag) =>
  campaignTemplates.find((template) => template.id === id)?.benefit.imagePath;

/**
 * 39ショップ, リピート購入 or ブランドデー on the order: a card with the campaign's image, checked when the order
 * gets it. Checking it changes the card's colors only, never its size. `rate` (「+1」) goes on a
 * line of its own, so a narrow card does not break the name.
 */
export function CampaignCheck({
  campaign,
  checked,
  onChange,
  describedBy,
  rate,
  children,
}: {
  campaign: "39shop" | OrderTag;
  rate?: string;
  checked: boolean;
  onChange: () => void;
  describedBy?: string;
  children: ReactNode;
}) {
  const imagePath = campaignImage(campaign);
  return (
    <CheckboxCard.Root
      checked={checked}
      onChange={onChange}
      colorScheme="primary"
      size="sm"
      w="auto"
      minH="11"
      alignItems="center"
      inputProps={{ "aria-describedby": describedBy }}
    >
      <Flex as="span" align="center" gap="2">
        {imagePath ? (
          <Image src={imageUrl(imagePath)} alt="" boxSize="7" objectFit="contain" flexShrink="0" />
        ) : null}
        <CheckboxCard.Label wordBreak="keep-all">
          {children}
          {rate ? (
            <>
              {" "}
              <Text as="span" display="block" fontVariantNumeric="tabular-nums">
                {rate}
              </Text>
            </>
          ) : null}
        </CheckboxCard.Label>
      </Flex>
    </CheckboxCard.Root>
  );
}

export const secondaryButton = {
  type: "button",
  h: "11",
  px: "4",
  rounded: "xl",
  borderWidth: "1px",
  borderColor: "border.emphasized",
  bg: "bg.panel",
  color: "fg",
  fontSize: "sm",
} as const;

export const withTag = <T extends string>(tags: T[], tag: T, on: boolean): T[] =>
  on ? [...new Set([...tags, tag])] : tags.filter((other) => other !== tag);

/** The shop an item URL points to: one in the registry, or a new one to create. */
export type ShopFromUrl =
  | { kind: "registered"; shop: Shop }
  | { kind: "new"; channel: ChannelId; shopCode: string; name: string };

/**
 * Picks the registry shop of a pasted item URL: the same channel and shop code, or the channel's
 * only shop. `null` when the URL is not one we can read.
 */
export function shopFromUrl(url: string, shops: Shop[]): ShopFromUrl | null {
  const parsed = parseUrl(url.trim());
  if (!parsed) return null;
  const match = shops.find(
    (shop) =>
      shop.channel === parsed.channel &&
      (parsed.shopCode
        ? shop.shopCode === parsed.shopCode
        : channels[parsed.channel].shopUnit === "single"),
  );
  if (match) return { kind: "registered", shop: match };
  return {
    kind: "new",
    channel: parsed.channel,
    shopCode: parsed.shopCode ?? "",
    name: parsed.shopCode ?? channels[parsed.channel].label,
  };
}

/**
 * The shop of an Ichiba item found by its URL: the registry shop of its shop code, or a new one
 * under the name the shop goes by.
 */
export function shopFromItem(item: RakutenItem, shops: Shop[]): ShopFromUrl {
  const match = shops.find(
    (shop) => shop.channel === "rakuten-ichiba" && shop.shopCode === item.shopCode,
  );
  if (match) return { kind: "registered", shop: match };
  return { kind: "new", channel: "rakuten-ichiba", shopCode: item.shopCode, name: item.shopName };
}

/** What a found item puts in the item's fields. A price without tax is left to be typed. */
export const fieldsFromItem = (item: RakutenItem) => ({
  name: item.name,
  unitPrice: item.taxIncludedPrice === undefined ? undefined : String(item.taxIncludedPrice),
  shopPointRate: item.pointRate >= 2 ? String(item.pointRate) : "",
});

/** What a form says about the order's shop. */
export type ShopChoice = {
  /** A registry shop id, or `NEW_SHOP`. */
  shop: string;
  newShopName: string;
  channel: ChannelId;
  shopCode: string;
  is39: boolean;
};

/** The order's shop, and what to save to the registry before the order. */
export type ShopToSave = {
  shopId: string | undefined;
  /** The shop as it will be once saved, for the preview. */
  shop: Shop | undefined;
  /** The change to save first. */
  change: ShopChange | undefined;
};

/**
 * The order's shop id, and the shop to save first: a new shop (or the registry shop it turns out
 * to be), or the chosen shop when its 39ショップ mark changes. A registry shop gets only its mark
 * changed, so a change saved to it elsewhere in the meantime is kept.
 */
export function shopToSave(choice: ShopChoice, shops: Shop[]): ShopToSave {
  if (
    choice.shop === "" ||
    (choice.shop === NEW_SHOP && choice.newShopName === "" && choice.shopCode === "")
  ) {
    return { shopId: undefined, shop: undefined, change: undefined };
  }
  const tags = (current: ShopTag[]) => withTag(current, "39shop", choice.is39);
  const mark = (shop: Shop): ShopToSave => ({
    shopId: shop.id,
    shop: { ...shop, tags: tags(shop.tags) },
    change: changeShop(shop.id, (current) => ({ ...current, tags: tags(current.tags) })),
  });
  if (choice.shop === NEW_SHOP) {
    // A shop from a URL is the same shop only with the same shop code; a typed name is matched by
    // name, on the same channel.
    const existing = shops.find(
      (other) =>
        other.channel === choice.channel &&
        (choice.shopCode ? other.shopCode === choice.shopCode : other.name === choice.newShopName),
    );
    if (existing) return mark(existing);
    const shop: Shop = {
      id: crypto.randomUUID(),
      channel: choice.channel,
      ...(choice.shopCode ? { shopCode: choice.shopCode } : {}),
      name: choice.newShopName || choice.shopCode,
      tags: tags([]),
      updatedAt: new Date().toISOString(),
    };
    return { shopId: shop.id, shop, change: replaceShop(shop) };
  }
  const chosen = shops.find((other) => other.id === choice.shop);
  if (chosen && chosen.tags.includes("39shop") !== choice.is39) return mark(chosen);
  return { shopId: choice.shop, shop: undefined, change: undefined };
}
