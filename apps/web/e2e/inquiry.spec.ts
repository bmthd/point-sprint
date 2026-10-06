import { expect, test } from "./fixtures";

// The preview's Worker has no Turnstile secret (`playwright.config.ts`), so the server function
// stops before it calls siteverify or sends a mail: what is tested is the way there and back.

test("the inquiry page is reached from the footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "お問い合わせ" }).click();
  await expect(page).toHaveURL(/\/inquiry\/?$/);
  await expect(page).toHaveTitle("お問い合わせ | ポイントスプリント");
  await expect(page.getByRole("heading", { level: 1, name: "お問い合わせ" })).toBeVisible();
});

test("a failed send says so and keeps the input", async ({ page }) => {
  await page.goto("/inquiry");
  const form = page.getByRole("form", { name: "お問い合わせ" });
  const submit = form.getByRole("button", { name: "送信する" });
  await expect(submit).toBeDisabled();
  await form.getByRole("button", { name: "確認を済ませる" }).click();

  await submit.click();
  await expect(form.getByText("返信先のメールアドレスを入れてください")).toBeVisible();
  await expect(form.getByText("お問い合わせの内容を入れてください")).toBeVisible();

  await form.getByRole("textbox", { name: /^返信先のメールアドレス/ }).fill("user@example.com");
  await form.getByRole("textbox", { name: /^お問い合わせの内容/ }).fill("計算が合いません。");
  const call = page.waitForRequest((request) => request.url().includes("/_serverFn/"));
  await submit.click();
  expect((await call).method()).toBe("POST");

  await expect(form.getByRole("alert")).toHaveText(
    "送信できませんでした。時間をおいて、もう一度お試しください。",
  );
  await expect(form.getByRole("textbox", { name: /^返信先のメールアドレス/ })).toHaveValue(
    "user@example.com",
  );
  await expect(form.getByRole("textbox", { name: /^お問い合わせの内容/ })).toHaveValue(
    "計算が合いません。",
  );
});
