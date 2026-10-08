import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { NoticeSection } from "./notice-section";
import type { Notice } from "./notices";

const notice = (date: string, title: string): Notice => ({
  date,
  title,
  body: `${title}の本文です。\n\n2段落目です。`,
});

async function renderNotices(notices: Notice[]) {
  await cleanup();
  return render(
    <UIProvider theme={theme} config={config}>
      <NoticeSection notices={notices} />
    </UIProvider>,
  );
}

const section = () => page.getByRole("region", { name: "お知らせ" });
const titles = () =>
  section()
    .getByRole("heading", { level: 3 })
    .elements()
    .map((element) => element.textContent);

test("shows the notices newest first, with the date, the title and each paragraph", async () => {
  await renderNotices([notice("2026-10-01", "古い"), notice("2026-10-20", "新しい")]);

  await expect.element(section()).toHaveAttribute("id", "notices");
  expect(titles()).toEqual(["新しい", "古い"]);
  const latest = section().getByRole("article").first();
  await expect.element(latest.getByText("新しいの本文です。")).toBeVisible();
  await expect.element(latest.getByText("2段落目です。")).toBeVisible();
  const time = latest.element().querySelector("time");
  expect(time?.textContent).toBe("2026年10月20日");
  expect(time?.getAttribute("datetime")).toBe("2026-10-20");
});

test("folds all but the latest three under 以前のお知らせ", async () => {
  await renderNotices(
    ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"].map((date) =>
      notice(date, `お知らせ ${date}`),
    ),
  );

  const older = section().getByText("以前のお知らせ（2件）");
  await expect.element(older).toBeVisible();
  await expect.element(section().getByText("お知らせ 2026-10-03")).toBeVisible();
  await expect.element(section().getByText("お知らせ 2026-10-02")).not.toBeVisible();

  await older.click();
  await expect.element(section().getByText("お知らせ 2026-10-02")).toBeVisible();
  expect(titles()).toEqual([
    "お知らせ 2026-10-05",
    "お知らせ 2026-10-04",
    "お知らせ 2026-10-03",
    "お知らせ 2026-10-02",
    "お知らせ 2026-10-01",
  ]);
});

test("says so when there is no notice", async () => {
  await renderNotices([]);
  await expect.element(section().getByText("お知らせはありません。")).toBeVisible();
});
