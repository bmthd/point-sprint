import { expect, test } from "./fixtures";
import { InquiryPage, TopPage } from "./pages";

// The preview's Worker has no inquiry destination (`playwright.config.ts`), so the server function
// stops before it calls siteverify or sends a mail: what is tested is the way there and back.

test("the inquiry page is reached from the footer", async ({ page }) => {
  const top = await TopPage.open(page);
  const inquiry = await top.footer.goToInquiry();
  await expect(page).toHaveTitle("お問い合わせ | ポイントスプリント");
  await expect(inquiry.heading).toBeVisible();
});

test("a failed send says so and keeps the input", async ({ page }) => {
  const inquiry = await InquiryPage.open(page);
  await expect(inquiry.submit).toBeDisabled();
  await inquiry.passCheck();

  await inquiry.submit.click();
  await expect(inquiry.form.getByText("返信先のメールアドレスを入れてください")).toBeVisible();
  await expect(inquiry.form.getByText("お問い合わせの内容を入れてください")).toBeVisible();

  await inquiry.email.fill("user@example.com");
  await inquiry.message.fill("計算が合いません。");
  const call = page.waitForRequest((request) => request.url().includes("/_serverFn/"));
  await inquiry.submit.click();
  expect((await call).method()).toBe("POST");

  await expect(inquiry.alert).toHaveText(
    "送信できませんでした。時間をおいて、もう一度お試しください。",
  );
  await expect(inquiry.email).toHaveValue("user@example.com");
  await expect(inquiry.message).toHaveValue("計算が合いません。");
});
