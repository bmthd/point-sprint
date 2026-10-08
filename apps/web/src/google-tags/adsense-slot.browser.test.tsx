import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { AdsenseSlot } from "./adsense-slot";

afterEach(async () => {
  await cleanup();
  delete window.adsbygoogle;
});

test("places an ad unit and asks AdSense to fill it", async () => {
  const screen = await render(<AdsenseSlot clientId="ca-pub-8953986206743618" slot="6586835241" />);

  const unit = screen.container.querySelector("ins.adsbygoogle");
  expect(unit?.getAttribute("data-ad-client")).toBe("ca-pub-8953986206743618");
  expect(unit?.getAttribute("data-ad-slot")).toBe("6586835241");
  expect(unit?.getAttribute("data-ad-format")).toBe("auto");
  expect(window.adsbygoogle).toEqual([{}]);
});

test("renders nothing without a client ID, as in development and tests", async () => {
  const screen = await render(<AdsenseSlot slot="6586835241" />);

  expect(screen.container.querySelector("ins")).toBeNull();
  expect(window.adsbygoogle).toBeUndefined();
});
