"use server";

import { FormState } from "@/ui/form";
import { env } from "@/utils/env";
import { sendMailFromAdmin } from "@/utils/mail";
import { parseWithValibot } from "conform-to-valibot";
import { inquiryForm$ } from "../../schema";

const adminAddress = env.GMAIL_ADDRESS;

const sendInquiryMail = async ({ email, name, message }: inquiryForm$) =>
  sendMailFromAdmin({
    from: email,
    to: adminAddress,
    subject: "ポイントスプリント お問い合わせフォームからのメッセージ",
    text: `メールアドレス: ${email}
    お名前:${name}
    メッセージ: ${message}`,
  });

/**
 * お問い合わせフォームのデータを処理
 * @param formData お問い合わせフォームのデータ
 */
export const inquiryAction = async (
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> => {
  const submission = parseWithValibot(formData, { schema: inquiryForm$ });
  if (submission.status !== "success") {
    return { status: "error", submissionResult: submission.reply() };
  }

  try {
    await sendInquiryMail(submission.value);
  } catch (error) {
    console.error("Failed to send mail", { error });
    return {
      status: "error",
      message: "予期しないエラーが発生しました。しばらく待ってからお試しください。",
    };
  }
  return { status: "success", message: "お問い合わせを受け付けました" };
};
