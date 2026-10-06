import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { NoticeList } from "./notice-list";
import { formatNoticeDate, newestFirst, notices } from "./notices";

const [latest, second] = newestFirst(notices);

test("shows the newest notice and keeps the older ones closed until opened", async () => {
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <NoticeList />
    </UIProvider>,
  );
  await expect.element(screen.getByRole("heading", { name: latest!.title })).toBeVisible();
  await expect.element(screen.getByText(latest!.body[0]!)).toBeVisible();

  const body = screen.getByText(second!.body[0]!);
  await expect.element(body).not.toBeVisible();
  await screen.getByText(`${formatNoticeDate(second!.date)} ${second!.title}`).click();
  await expect.element(body).toBeVisible();
});
