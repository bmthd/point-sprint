import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { ShareButton } from "./share-button";

const target = { text: "獲得予定 2,600P", url: "https://point-sprint.bmth.dev/" };

/** Gives the page a Web Share API, or (with `undefined`) takes it away. */
function stubShare(share: ((data: ShareData) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  Object.defineProperty(navigator, "canShare", {
    value: share ? () => true : undefined,
    configurable: true,
  });
}

afterEach(() => {
  // Back to the browser's own `navigator.share`, if it has one.
  delete (navigator as { share?: unknown }).share;
  delete (navigator as { canShare?: unknown }).canShare;
});

async function renderShareButton() {
  await cleanup();
  return render(
    <UIProvider theme={theme} config={config}>
      <ShareButton label="結果をシェア" target={target} />
    </UIProvider>,
  );
}

test("with the Web Share API, the button opens the device's share sheet", async () => {
  const share = vi.fn(async (_data: ShareData) => {});
  stubShare(share);
  const screen = await renderShareButton();

  await screen.getByRole("button", { name: "結果をシェア" }).click();

  expect(share).toHaveBeenCalledWith(target);
  await expect.element(screen.getByRole("link", { name: "X でシェア" })).not.toBeInTheDocument();
});

test("closing the share sheet does not open the links", async () => {
  stubShare(async () => {
    throw new DOMException("Share canceled", "AbortError");
  });
  const screen = await renderShareButton();

  await screen.getByRole("button", { name: "結果をシェア" }).click();

  const button = screen.getByRole("button", { name: "結果をシェア" });
  await expect.element(button).toHaveAttribute("aria-expanded", "false");
});

test("when the share sheet fails, the links open instead", async () => {
  stubShare(async () => {
    throw new DOMException("Not allowed", "NotAllowedError");
  });
  const screen = await renderShareButton();

  await screen.getByRole("button", { name: "結果をシェア" }).click();

  await expect.element(screen.getByRole("link", { name: "X でシェア" })).toBeVisible();
});

test("without the Web Share API, the button opens the links to each service", async () => {
  stubShare(undefined);
  const screen = await renderShareButton();
  const button = screen.getByRole("button", { name: "結果をシェア" });
  await expect.element(button).toHaveAttribute("aria-expanded", "false");

  await button.click();

  await expect.element(button).toHaveAttribute("aria-expanded", "true");
  for (const [name, origin] of [
    ["X でシェア", "https://x.com/"],
    ["Facebook でシェア", "https://www.facebook.com/"],
    ["LINE で送る", "https://social-plugins.line.me/"],
  ] as const) {
    const link = screen.getByRole("link", { name });
    await expect.element(link).toHaveAttribute("href", expect.stringContaining(origin));
    await expect.element(link).toHaveAttribute("target", "_blank");
    await expect.element(link).toHaveAttribute("rel", "noopener noreferrer");
  }

  await button.click();
  await expect.element(button).toHaveAttribute("aria-expanded", "false");
  await expect.element(screen.getByRole("link", { name: "X でシェア" })).not.toBeInTheDocument();
});

test("the copy button copies the text and the link, and says so on the screen", async () => {
  stubShare(undefined);
  const screen = await renderShareButton();
  const copies: string[] = [];
  const onCopy = () => copies.push(window.getSelection()?.toString() ?? "");
  // Captured: the copy library stops the event at its own element.
  document.addEventListener("copy", onCopy, true);

  await screen.getByRole("button", { name: "結果をシェア" }).click();
  await screen.getByRole("button", { name: "文面とリンクをコピー" }).click();
  document.removeEventListener("copy", onCopy, true);

  expect(copies).toEqual(["獲得予定 2,600P\nhttps://point-sprint.bmth.dev/"]);
  await expect
    .element(screen.getByRole("status"))
    .toHaveTextContent("文面とリンクをコピーしました");
});

test("every button and link is at least 44px tall and works from the keyboard", async () => {
  stubShare(undefined);
  const screen = await renderShareButton();

  await userEvent.tab();
  await expect.element(screen.getByRole("button", { name: "結果をシェア" })).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await userEvent.tab();
  await expect.element(screen.getByRole("link", { name: "X でシェア" })).toHaveFocus();

  const controls = [...document.querySelectorAll<HTMLElement>("button, a")].map(
    (element) => element.getBoundingClientRect().height,
  );
  expect(controls).toHaveLength(5);
  for (const height of controls) expect(height).toBeGreaterThanOrEqual(44);
});
