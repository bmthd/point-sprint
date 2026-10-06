import * as v from "valibot";

// What the inquiry form sends. The form checks it before sending, and the server checks it again.

export const InquiryInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.maxLength(100, "名前は100文字以内で入れてください")),
  // Valibot's email check lets no line break through, so the address is safe in a header.
  email: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("返信先のメールアドレスを入れてください"),
    v.maxLength(254, "メールアドレスが長すぎます"),
    v.email("メールアドレスの形で入れてください"),
  ),
  body: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("お問い合わせの内容を入れてください"),
    v.maxLength(5000, "内容は5000文字以内で入れてください"),
  ),
});

export type InquiryInput = v.InferOutput<typeof InquiryInputSchema>;

/** The form's input and the Turnstile token the widget gave for it. */
export const InquiryRequestSchema = v.object({
  ...InquiryInputSchema.entries,
  turnstileToken: v.pipe(v.string(), v.nonEmpty(), v.maxLength(2048)),
});

export type InquiryRequest = v.InferInput<typeof InquiryRequestSchema>;
