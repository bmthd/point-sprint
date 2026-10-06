import type { InquiryInput } from "./inquiry-input";

// The inquiry as a raw MIME message, for `EmailMessage` of `cloudflare:email`.

/** The sender, on the domain whose Email Routing sends the mail. */
export const INQUIRY_FROM = "inquiry@bmth.dev";
const FROM_NAME = "ポイントスプリント";
export const INQUIRY_SUBJECT = "【ポイントスプリント】お問い合わせ";

const CRLF = "\r\n";
const encoder = new TextEncoder();

const base64 = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));

/**
 * A header value as MIME encoded-words (RFC 2047, "B" encoding), each at most 75 characters and
 * cut between characters, folded onto lines of their own. ASCII without `=?` is left as it is.
 */
export function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value) && !value.includes("=?")) return value;
  // `=?UTF-8?B?` and `?=` leave 63 characters, which hold 45 bytes of base64.
  const maxBytes = 45;
  const words: string[] = [];
  let chunk: number[] = [];
  for (const char of value) {
    const bytes = encoder.encode(char);
    if (chunk.length + bytes.length > maxBytes) {
      words.push(`=?UTF-8?B?${base64(Uint8Array.from(chunk))}?=`);
      chunk = [];
    }
    chunk.push(...bytes);
  }
  words.push(`=?UTF-8?B?${base64(Uint8Array.from(chunk))}?=`);
  return words.join(`${CRLF} `);
}

/** Base64 of the text with CRLF line ends, in lines of 76 characters. */
const encodeBody = (text: string) =>
  (base64(encoder.encode(text.replace(/\r?\n/g, CRLF))).match(/.{1,76}/g) ?? []).join(CRLF);

/** "2026-10-07 21:05", in Japan time. */
const tokyoTime = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

export type InquiryMail = {
  inquiry: InquiryInput;
  /** The operator's address: an address verified in Email Routing. */
  to: string;
  sentAt: Date;
  /** Unique to this mail, without the angle brackets. */
  messageId: string;
};

/** The mail to the operator. A reply goes to the address the user gave (`Reply-To`). */
export function buildInquiryMail({ inquiry, to, sentAt, messageId }: InquiryMail): string {
  const text = [
    "ポイントスプリントの問い合わせフォームから届きました。",
    "",
    `名前: ${inquiry.name === "" ? "（なし）" : inquiry.name}`,
    `返信先: ${inquiry.email}`,
    `送信日時: ${tokyoTime(sentAt)}（日本時間）`,
    "",
    "内容:",
    inquiry.body,
    "",
  ].join("\n");
  const headers = [
    `From: ${encodeHeaderValue(FROM_NAME)} <${INQUIRY_FROM}>`,
    `To: <${to}>`,
    `Reply-To: <${inquiry.email}>`,
    `Subject: ${encodeHeaderValue(INQUIRY_SUBJECT)}`,
    `Date: ${sentAt.toUTCString()}`,
    `Message-ID: <${messageId}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  return [...headers, "", encodeBody(text), ""].join(CRLF);
}
