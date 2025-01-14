import * as v from "valibot";

export const schema = v.required(
  v.object({
    name: v.string(),
    email: v.string(),
    message: v.string(),
  }),
  "すべての項目が入力されていません",
);

export type schema = v.InferInput<typeof schema>;
