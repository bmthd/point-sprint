// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { setInput, useField } from "@formisch/react";
import { Autocomplete, Field } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { errorsOf } from "../../form/form";
import { shopsAtom } from "../../state/queries";
import type { OrderForm } from "./-order-editor/order-form-store";
import { NEW_SHOP, optionalMark, useSortedShops } from "./-order-fields";

/** The label of the choice that makes a shop of the typed name. */
const createLabel = (name: string) => `「${name}」を新しく作る`;

/**
 * The order's shop: typed to find a saved shop, or to make a new one of that name, in one field
 * that never adds another. Workaround: Yamada UI's `Autocomplete` takes a typed value
 * (`allowCustomValue`) but offers no choice to create it, so the last choice does; drop that
 * choice when `Autocomplete` can create one itself.
 */
export function ShopAutocomplete({ form, size }: { form: OrderForm; size?: "lg" }) {
  const shops = useAtomValue(shopsAtom);
  const sortedShops = useSortedShops(shops);
  const shop = useField(form, { path: ["shop"] });
  const newShopName = useField(form, { path: ["newShopName"] });

  const chosen = shops.find((other) => other.id === shop.input);
  const typed = typeof newShopName.input === "string" ? newShopName.input : "";
  const text =
    shop.input === NEW_SHOP ? typed : (chosen?.name ?? (shop.input === "" ? "" : "不明なショップ"));
  const exact = shops.some((other) => other.name === text.trim());

  const choose = (id: string) => {
    const next = shops.find((other) => other.id === id);
    shop.onChange(id);
    setInput(form, { path: ["newShopName"], input: "" });
    setInput(form, { path: ["shopCode"], input: "" });
    setInput(form, { path: ["is39"], input: next?.tags.includes("39shop") ?? false });
  };

  const type = (value: string) => {
    // Picking the create choice puts its label in the input: the name stays as it was typed.
    if (value === createLabel(typed)) return;
    const name = value.trim();
    if (name === "") {
      choose("");
      return;
    }
    const same = shops.find((other) => other.name === name);
    if (same) {
      choose(same.id);
      return;
    }
    if (shop.input !== NEW_SHOP) {
      shop.onChange(NEW_SHOP);
      setInput(form, { path: ["shopCode"], input: "" });
      setInput(form, { path: ["is39"], input: false });
    }
    newShopName.onChange(value);
  };

  return (
    <Field.Root
      label="ショップ"
      optionalIndicator={optionalMark}
      {...errorsOf(shop.input === NEW_SHOP ? newShopName : shop)}
      minW="0"
    >
      <Autocomplete.Root
        size={size}
        allowCustomValue
        placeholder="作成または選択"
        inputValue={text}
        onInputChange={type}
        value={shop.input === NEW_SHOP ? NEW_SHOP : String(shop.input ?? "")}
        onChange={(value) => {
          if (value !== NEW_SHOP && shops.some((other) => other.id === value)) choose(value);
        }}
        emptyMessage="保存したショップはまだありません"
        items={[
          ...sortedShops.map((other) => ({ label: other.name, value: other.id })),
          ...(text.trim() !== "" && !exact
            ? [{ label: createLabel(text.trim()), value: NEW_SHOP }]
            : []),
        ]}
      />
    </Field.Root>
  );
}
