import * as v from "valibot";

/** `edit` opens the order editor: `new` for a new order, or the id of the order to edit. */
export const planSearchSchema = v.object({
  id: v.optional(v.string()),
  edit: v.optional(v.string()),
});
