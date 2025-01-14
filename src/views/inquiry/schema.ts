import * as v from "valibot";

export const schema = v.object({
  name: v.nonOptional(v.string()),
  email: v.nonOptional(v.pipe(v.string(), v.email())),
  message: v.nonOptional(v.string()),
});

export type schema = v.InferInput<typeof schema>;
