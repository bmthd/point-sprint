import * as v from "valibot";

declare module "@tanstack/react-router" {
  interface HistoryState {
    /**
     * The settings' side panel was opened over the plan, the history entry before this one, which
     * closing the panel goes back to.
     */
    settingsOverPlan?: true;
  }
}

/**
 * `edit` opens the order editor: `new` for a new order, or the id of the order to edit. `spu`
 * opens the SPU of a month (`YYYY-MM`) in the side panel on a desktop. `settings` opens the plan's
 * settings in the side panel on a desktop, under the URL of their own page (`settingsPanel`).
 */
export const PlanSearchSchema = v.object({
  id: v.optional(v.string()),
  edit: v.optional(v.string()),
  spu: v.optional(v.string()),
  // Anything but `true` reads as closed, not as a broken URL.
  settings: v.fallback(v.optional(v.literal(true)), undefined),
});

/**
 * Opens the plan's settings in the side panel on a desktop. The address bar shows their own page,
 * `/plan/settings?id=`, which a reload or a shared link opens in full, as an intercepted route does.
 */
export function settingsPanel(planId: string) {
  return {
    to: "/plan",
    search: { id: planId, settings: true },
    // Only the mask's `unmaskOnReload` reaches the history entry; the navigation's own is dropped.
    mask: { to: "/plan/settings", search: { id: planId }, unmaskOnReload: true },
    resetScroll: false,
  } as const;
}
