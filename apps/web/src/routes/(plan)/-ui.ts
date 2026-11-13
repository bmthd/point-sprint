import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// UI-only state. Saved data never lives here; it flows from the query atoms.

/** The order whose form is open. On a phone only one is open at a time. */
export const openOrderIdAtom = atom<string | null>(null);

/** Orders whose point breakdown is expanded. */
export const expandedBreakdownIdsAtom = atom<ReadonlySet<string>>(new Set<string>());

/** Whether the order list is in reorder mode. */
export const reorderModeAtom = atom(false);

/** How a new order is entered: by its amount, or by its item's URL. */
export type EntryMode = "amount" | "url";

/** The key under which this device remembers how the last new order was entered. */
export const ENTRY_MODE_KEY = "point-sprint:order-entry-mode";

/** How the last new order was entered on this device, which the next one starts with. */
export const entryModeAtom = atomWithStorage<EntryMode>(ENTRY_MODE_KEY, "amount", undefined, {
  // Read at once, so that a form opened on the URL does not first show the amount.
  getOnInit: true,
});
