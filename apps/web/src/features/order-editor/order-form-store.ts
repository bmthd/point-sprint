// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { type FormStore, getInput, setInput, useField } from "@formisch/react";
import { useAtomValue } from "jotai";
import { shopsAtom } from "../../state/queries";
import { useItemAutofill } from "../../rakuten/item-autofill";
import { NEW_SHOP, type ShopFromUrl, fieldsFromItem, shopFromItem } from "../../form/order-fields";
import type { OrderFormSchema } from "./order-form";

// What the order editor and the desktop list's add form do with the same order form.

export type OrderForm = FormStore<typeof OrderFormSchema>;

export const AMOUNT_PATH = ["items", 0, "unitPrice"] as const;

/** The form's input, re-read whenever a field changes (`useField` subscribes this component). */
export function useFormInput(form: OrderForm) {
  useField(form, { path: ["shop"] });
  return getInput(form);
}

/** Selects the shop of a URL or a found item: a registry shop, or a new one with its code. */
export function applyShop(form: OrderForm, found: ShopFromUrl) {
  if (found.kind === "registered") {
    setInput(form, { path: ["shop"], input: found.shop.id });
    setInput(form, { path: ["is39"], input: found.shop.tags.includes("39shop") });
    return;
  }
  setInput(form, { path: ["shop"], input: NEW_SHOP });
  setInput(form, { path: ["channel"], input: found.channel });
  setInput(form, { path: ["shopCode"], input: found.shopCode });
  setInput(form, { path: ["newShopName"], input: found.name });
  setInput(form, { path: ["is39"], input: false });
}

/** Puts a found item's name, price, shop and shop rate in the fields, where they can be edited. */
export function useOrderAutofill(form: OrderForm) {
  const shops = useAtomValue(shopsAtom);
  return useItemAutofill((item) => {
    applyShop(form, shopFromItem(item, shops));
    const fields = fieldsFromItem(item);
    setInput(form, { path: ["items", 0, "name"], input: fields.name });
    if (fields.unitPrice !== undefined)
      setInput(form, { path: AMOUNT_PATH, input: fields.unitPrice });
    setInput(form, { path: ["items", 0, "shopPointRate"], input: fields.shopPointRate });
  });
}
