import * as v from "valibot";

/**
 * `edit` opens the order editor: `new` for a new order, or the id of the order to edit. `spu`
 * opens the SPU of a month (`YYYY-MM`) in the side panel on a desktop.
 */
export const PlanSearchSchema = v.object({
  id: v.optional(v.string()),
  edit: v.optional(v.string()),
  spu: v.optional(v.string()),
});
