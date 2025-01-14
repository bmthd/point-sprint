import * as v from "valibot";

export const schema = v.required(
  v.object({
    name: v.nonOptional(v.string()),
    email: v.string(),
    message: v.string(),
  }),
  "すべての項目を入力してください。",
);

export type schema = v.InferInput<typeof schema>;
