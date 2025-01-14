import * as v from "valibot";

export const inquiryForm$ = v.object({
  name: v.nonOptional(v.string()),
  email: v.nonOptional(v.pipe(v.string(), v.email())),
  message: v.nonOptional(v.string()),
});

export type inquiryForm$ = v.InferInput<typeof inquiryForm$>;
