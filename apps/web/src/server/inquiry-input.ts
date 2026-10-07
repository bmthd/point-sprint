import * as v from "valibot";
import { requiredTextSchema, textSchema } from "../form/field-schemas";

// What the inquiry form sends. The form checks it before sending, and the server checks it again.

export const InquiryInputSchema = v.object({
  name: textSchema("お名前", 100),
  // Valibot's email check lets no line break through, so the address is safe in a header.
  email: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("返信先のメールアドレスを入れてください"),
    v.maxLength(254, "メールアドレスは254文字以内で入れてください"),
    v.email("メールアドレスの形で入れてください"),
  ),
  wantsReply: v.boolean(),
  body: requiredTextSchema("お問い合わせの内容", 5000),
});

export type InquiryInput = v.InferOutput<typeof InquiryInputSchema>;

/** The form's input and the Turnstile token the widget gave for it. */
export const InquiryRequestSchema = v.object({
  ...InquiryInputSchema.entries,
  turnstileToken: v.pipe(v.string(), v.nonEmpty(), v.maxLength(2048)),
});

export type InquiryRequest = v.InferInput<typeof InquiryRequestSchema>;
