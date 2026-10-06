import { type ChannelId, type Shop, type ShopTag, channels, parseUrl } from "@workspaces/domain";
import { Box, Button, Input, Text, Field as UIField } from "@workspaces/ui";
import { type ReactNode, useId, useMemo, useRef, useState } from "react";
import * as v from "valibot";
import { type ShopChange, changeShop, replaceShop } from "../../state/mutations";
import type { RakutenItem } from "../../rakuten/item-search";
import { taxRateLabel } from "./order-shared";

// Fields shared by the desktop list's edit grid, its add form and the order editor.

export const NEW_SHOP = "new";
export const TAX_RATES = ["0.1", "0.08", "0"] as const;
export type TaxRateValue = (typeof TAX_RATES)[number];

export const taxRateValue = (rate: number): TaxRateValue =>
  rate === 0.08 ? "0.08" : rate === 0 ? "0" : "0.1";

/** The grid that wraps the fields by the width available. */
export const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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
    <Box display="flex" flexDirection="column" gap="1" minW="0">
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
    </Box>
  );
}

const normalize = (text: string) => text.normalize("NFKC").trim();

/** A tax-included amount in yen. Accepts full-width digits, commas and ¥. */
export const AmountSchema = v.pipe(
  v.string(),
  v.transform((text) => normalize(text).replace(/[,¥\s]/g, "")),
  v.nonEmpty("金額を入れてください"),
  v.regex(/^\d+$/, "金額は円の整数で入れてください"),
  v.transform(Number),
  v.safeInteger("金額は円の整数で入れてください"),
);

export const DateSchema = v.pipe(
  v.string(),
  v.nonEmpty("注文日を入れてください"),
  v.isoDate("注文日は YYYY-MM-DD で入れてください"),
);

/** A coupon in yen; empty for none. */
export const DiscountSchema = v.union(
  [
    v.pipe(
      v.string(),
      v.transform(normalize),
      v.literal(""),
      v.transform(() => 0),
    ),
    AmountSchema,
  ],
  "クーポン値引額は円の整数で入れてください",
);

export const QuantitySchema = v.pipe(
  v.string(),
  v.transform(normalize),
  v.regex(/^\d+$/, "数量は1以上の整数で入れてください"),
  v.transform(Number),
  v.safeInteger("数量は1以上の整数で入れてください"),
  v.minValue(1, "数量は1以上の整数で入れてください"),
);

/** Empty for no rate of its own, or a number of 1 or more. */
export const ShopRateSchema = v.union(
  [
    v.pipe(
      v.string(),
      v.transform(normalize),
      v.literal(""),
      v.transform(() => undefined),
    ),
    v.pipe(v.string(), v.transform(normalize), v.transform(Number), v.number(), v.minValue(1)),
  ],
  "1以上の数で入れてください",
);

/**
 * A text field that saves its value on Enter or when it loses the focus, and only when `schema`
 * accepts it. Give it a `key` of the saved value so it follows changes made elsewhere.
 */
export function CommitField<T>({
  label,
  initial,
  schema,
  onCommit,
  inputMode,
  align = "start",
  placeholder,
}: {
  label: string;
  initial: string;
  schema: v.GenericSchema<string, T>;
  /** Saves the value; a rejected promise means it was not saved. */
  onCommit: (value: T) => Promise<unknown>;
  inputMode?: "numeric" | "decimal" | "text";
  align?: "start" | "end";
  placeholder?: string;
}) {
  const [text, setText] = useState(initial);
  // What was last saved (or is being saved), so a blur right after Enter does not save the same
  // value again. A failed save forgets it, so the same text can be tried again.
  const committed = useRef(initial);
  const [error, setError] = useState<string>();

  const commit = () => {
    const parsed = v.safeParse(schema, text);
    if (!parsed.success) {
      setError(parsed.issues[0].message);
      return;
    }
    setError(undefined);
    if (text === committed.current) return;
    const previous = committed.current;
    committed.current = text;
    onCommit(parsed.output).catch(() => {
      if (committed.current === text) committed.current = previous;
    });
  };

  return (
    <Field label={label} error={error}>
      <Input
        size="lg"
        inputMode={inputMode}
        placeholder={placeholder}
        fontVariantNumeric={align === "end" ? "tabular-nums" : undefined}
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) commit();
        }}
      />
    </Field>
  );
}

export function useSortedShops(shops: Shop[]) {
  return useMemo(() => [...shops].sort((a, b) => a.name.localeCompare(b.name, "ja")), [shops]);
}

export function TaxRateOptions() {
  return TAX_RATES.map((rate) => (
    <option key={rate} value={rate}>
      {taxRateLabel(Number(rate))}
    </option>
  ));
}

/** A chip that is on or off (39ショップ, リピート購入). */
export function ToggleChip({
  pressed,
  onClick,
  describedBy,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <Button
      size="lg"
      variant={pressed ? "solid" : "outline"}
      colorScheme="mono"
      aria-pressed={pressed}
      aria-describedby={describedBy}
      onClick={onClick}
    >
      {pressed ? <span aria-hidden="true">✓</span> : null}
      {children}
    </Button>
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
  shopId: string;
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
      name: choice.newShopName,
      tags: tags([]),
      updatedAt: new Date().toISOString(),
    };
    return { shopId: shop.id, shop, change: replaceShop(shop) };
  }
  const chosen = shops.find((other) => other.id === choice.shop);
  if (chosen && chosen.tags.includes("39shop") !== choice.is39) return mark(chosen);
  return { shopId: choice.shop, shop: undefined, change: undefined };
}
