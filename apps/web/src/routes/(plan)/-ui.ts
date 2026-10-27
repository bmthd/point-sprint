import { atom } from "jotai";

// UI-only state. Saved data never lives here; it flows from the query atoms.

/** The order whose form is open. On a phone only one is open at a time. */
export const openOrderIdAtom = atom<string | null>(null);

/** Orders whose point breakdown is expanded. */
export const expandedBreakdownIdsAtom = atom<ReadonlySet<string>>(new Set<string>());

/** Whether the order list is in reorder mode. */
export const reorderModeAtom = atom(false);
