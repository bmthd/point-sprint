"use server";

import { FormState } from "@/ui/form";
import { env } from "@/utils/env";
import { sendMailFromAdmin } from "@/utils/mail";
import { parseWithValibot } from "conform-to-valibot";
import { inquiryForm$ } from "../../schema";

const adminAddress = env.GMAIL_ADDRESS;

const sendInquiryMail = async ({ email, name, message }: inquiryForm$) => {
  const subject = "ポイントスプリント お問い合わせフォームからのメッセージ";
  const text = `メールアドレス: ${email}\n\nお名前:${name}\nメッセージ: ${message}`;
  await sendMailFromAdmin({ from: email, to: adminAddress, subject, text });
};

/**
 * お問い合わせフォームのデータを処理
 * @param formData お問い合わせフォームのデータ
 */
export const inquiryAction = async (
  prevState: FormState,
  formData: FormData,
): Promise<FormState> => {
  const submission = parseWithValibot(formData, { schema: inquiryForm$ });
  if (submission.status !== "success") {
    return { status: "error", submissionResult: submission.reply() };
  }

  try {
    await sendInquiryMail(submission.value);
  } catch {
    return {
      status: "error",
      message: "サーバー側でメールの送信に失敗しました。しばらく待ってからお試しください。",
    };
  }
  return { status: "success", message: "お問い合わせを受け付けました" };
};
