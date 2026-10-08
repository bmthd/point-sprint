import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { describe, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import type { InquiryResult } from "../../../server/inquiry";
import { InquiryForm, type SendInquiry } from "./inquiry-form";
import type { TurnstileWidgetProps } from "./turnstile-widget";

// Turnstile's script is not loaded and nothing is sent: the widget and the server function are
// stood in for.

/** Passes the check with a token numbered by the times it was reset. */
function FakeWidget({ onToken, resetKey }: TurnstileWidgetProps) {
  return (
    <button type="button" onClick={() => onToken(`token-${resetKey}`)}>
      確認を済ませる
    </button>
  );
}

/** Answers each send with the next result; an answer that is not an `InquiryResult` is a server error. */
const answering = (...results: (InquiryResult | Error | null)[]) => {
  const queue = [...results];
  return vi.fn<SendInquiry>(async () => {
    const result = queue.length > 0 ? queue.shift() : { ok: true };
    if (result instanceof Error) throw result;
    return result as InquiryResult;
  });
};

async function renderForm(
  send: SendInquiry,
  { siteKey }: { siteKey?: string } = { siteKey: "site-key" },
) {
  await cleanup();
  return render(
    <UIProvider theme={theme} config={config}>
      <InquiryForm send={send} siteKey={siteKey} widget={FakeWidget} />
    </UIProvider>,
  );
}

type Screen = Awaited<ReturnType<typeof renderForm>>;

const fields = (screen: Screen) => ({
  name: screen.getByRole("textbox", { name: "お名前（任意）" }),
  email: screen.getByRole("textbox", { name: /^返信先のメールアドレス/ }),
  body: screen.getByRole("textbox", { name: /^お問い合わせの内容/ }),
  submit: screen.getByRole("button", { name: "送信する" }),
  wantsReply: screen.getByRole("checkbox", { name: "返信を希望する" }),
  check: screen.getByRole("button", { name: "確認を済ませる" }),
});

async function fillIn(screen: Screen) {
  const { name, email, body } = fields(screen);
  await name.fill("山田 太郎");
  await email.fill("user@example.com");
  // The checkbox's own input is hidden: its label is what is clicked.
  await screen.getByText("返信を希望する").click();
  await body.fill("計算が合いません。");
}

const FAILED = "送信できませんでした。時間をおいて、もう一度お試しください。";

describe("the inquiry form", () => {
  test("cannot be sent until Turnstile's check has passed", async () => {
    const send = answering();
    const screen = await renderForm(send);
    await fillIn(screen);
    await expect.element(fields(screen).submit).toBeDisabled();

    await fields(screen).check.click();
    await expect.element(fields(screen).submit).toBeEnabled();
  });

  test("asks for the reply address and the message, and sends nothing without them", async () => {
    const send = answering();
    const screen = await renderForm(send);
    await fields(screen).check.click();
    await fields(screen).submit.click();

    await expect.element(screen.getByText("返信先のメールアドレスを入れてください")).toBeVisible();
    await expect.element(screen.getByText("お問い合わせの内容を入れてください")).toBeVisible();
    await expect.element(fields(screen).email).toHaveAttribute("aria-invalid", "true");

    await fields(screen).email.fill("user@");
    await fields(screen).submit.click();
    await expect.element(screen.getByText("メールアドレスの形で入れてください")).toBeVisible();
    expect(send).not.toHaveBeenCalled();
  });

  test("sends the input with the token, and says it was sent", async () => {
    const send = answering({ ok: true });
    const screen = await renderForm(send);
    await fillIn(screen);
    await fields(screen).check.click();
    await fields(screen).submit.click();

    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent(
        "お問い合わせを送信しました。内容を確認し、必要に応じて入力いただいたメールアドレスにご返信します。",
      );
    expect(send).toHaveBeenCalledExactlyOnceWith({
      name: "山田 太郎",
      email: "user@example.com",
      wantsReply: true,
      body: "計算が合いません。",
      turnstileToken: "token-0",
    });
    await expect
      .element(screen.getByRole("form", { name: "お問い合わせ" }))
      .not.toBeInTheDocument();
  });

  test.each([
    ["Turnstile turns the token down", { ok: false, stage: "turnstile" } as const],
    ["the mail cannot be sent", { ok: false, stage: "send" } as const],
    ["the server cannot be reached", new TypeError("Failed to fetch")],
    ["the server answers with an error of its own", null],
  ])("keeps the input to send again when %s", async (_, failure) => {
    const send = answering(failure, { ok: true });
    const screen = await renderForm(send);
    await fillIn(screen);
    await fields(screen).check.click();
    await fields(screen).submit.click();

    await expect.element(screen.getByRole("alert")).toHaveTextContent(FAILED);
    await expect.element(fields(screen).email).toHaveValue("user@example.com");
    await expect.element(fields(screen).body).toHaveValue("計算が合いません。");
    await expect.element(fields(screen).wantsReply).toBeChecked();
    // The used token is dropped, and the check starts again.
    await expect.element(fields(screen).submit).toBeDisabled();

    await fields(screen).check.click();
    await fields(screen).submit.click();
    await expect.element(screen.getByRole("status")).toBeVisible();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toMatchObject({
      email: "user@example.com",
      turnstileToken: "token-1",
    });
  });

  test("says it cannot take inquiries when the build had no site key", async () => {
    const screen = await renderForm(answering(), {});
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("いまはお問い合わせを受け付けられません。時間をおいてお試しください。");
    await expect.element(fields(screen).submit).toBeDisabled();
  });
});
