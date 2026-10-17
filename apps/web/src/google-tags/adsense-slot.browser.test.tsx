import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { AdsenseSlot } from "./adsense-slot";

afterEach(async () => {
  await cleanup();
  delete window.adsbygoogle;
});

test("places an ad unit and asks AdSense to fill it", async () => {
  const screen = await render(<AdsenseSlot clientId="ca-pub-8953986206743618" slot="6586835241" />);

  // AdSense fills the unit it finds by these attributes.
  const unit = screen.getByRole("insertion");
  await expect.element(unit).toHaveClass("adsbygoogle");
  await expect.element(unit).toHaveAttribute("data-ad-client", "ca-pub-8953986206743618");
  await expect.element(unit).toHaveAttribute("data-ad-slot", "6586835241");
  await expect.element(unit).toHaveAttribute("data-ad-format", "auto");
  expect(window.adsbygoogle).toEqual([{}]);
});

test("renders nothing without a client ID, as in development and tests", async () => {
  const screen = await render(<AdsenseSlot slot="6586835241" />);

  await expect.element(screen.getByRole("insertion")).not.toBeInTheDocument();
  expect(window.adsbygoogle).toBeUndefined();
});
