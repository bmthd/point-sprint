import { type Locator, type Page, expect } from "@playwright/test";

/** The profile's 「ほかの端末と同期」. */
export class SyncSection {
  readonly root: Locator;
  readonly status: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("region", { name: "ほかの端末と同期" });
    this.status = this.root.getByRole("status");
  }

  /** Starts to sync with a new passkey, and resolves to the recovery code shown once. */
  async start(): Promise<string> {
    await this.root.getByRole("button", { name: "パスキーで同期を始める" }).click();
    await this.root.getByRole("button", { name: "確認を済ませる" }).click();
    await this.root.getByRole("button", { name: "パスキーを作って始める" }).click();
    const dialog = this.page.getByRole("dialog", { name: "復元用のコードを控えてください" });
    const code = (await dialog.getByText(/^([0-9A-Z]{4}-){6}[0-9A-Z]{2}$/).textContent()) ?? "";
    await dialog.getByText("控えました").click();
    await dialog.getByRole("button", { name: "閉じる" }).click();
    await this.waitSynced();
    return code;
  }

  async logIn() {
    await this.root.getByRole("button", { name: "ほかの端末で始めた同期にログイン" }).click();
  }

  /** The dialog that asks for the recovery code after logging in. */
  get codeDialog() {
    return this.page.getByRole("dialog", { name: "復元用のコードを入れてください" });
  }

  async enterCode(code: string) {
    await this.codeDialog.getByRole("textbox", { name: "復元用のコード" }).fill(code);
    await this.codeDialog.getByRole("button", { name: "開く" }).click();
  }

  async waitSynced() {
    await expect(this.status).toContainText("同期しました");
  }
}
