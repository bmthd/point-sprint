"server-only";
import { createTransport } from "nodemailer";
import { env } from "../env";

type MailOptions = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

const transporter = createTransport({
  service: "gmail",
  auth: {
    user: env.GMAIL_ADDRESS,
    pass: env.GMAIL_PASSWORD,
  },
});

/**
 * メール送信
 * @param mailOptions メールオプション
 */
export const sendMailFromAdmin = (mailOptions: MailOptions) => transporter.sendMail(mailOptions);
