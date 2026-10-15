import { type Locator, type Page } from "@playwright/test";

/** The inquiry form. */
export class InquiryPage {
  readonly heading: Locator;
  readonly form: Locator;
  readonly email: Locator;
  readonly message: Locator;
  readonly submit: Locator;
  readonly alert: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1, name: "お問い合わせ" });
    this.form = page.getByRole("form", { name: "お問い合わせ" });
    this.email = this.form.getByRole("textbox", { name: /^返信先のメールアドレス/ });
    this.message = this.form.getByRole("textbox", { name: /^お問い合わせの内容/ });
    this.submit = this.form.getByRole("button", { name: "送信する" });
    this.alert = this.form.getByRole("alert");
  }

  static async open(page: Page) {
    await page.goto("/inquiry");
    return new InquiryPage(page);
  }

  /** Passes the stand-in Turnstile's check. */
  async passCheck() {
    await this.form.getByRole("button", { name: "確認を済ませる" }).click();
  }
}
