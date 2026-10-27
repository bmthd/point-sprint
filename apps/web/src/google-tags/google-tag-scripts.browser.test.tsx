import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { GoogleTagScripts } from "./google-tag-scripts";

test("renders no Google tag scripts in tests, which build without the IDs", async () => {
  const before = document.scripts.length;
  await render(<GoogleTagScripts />);

  expect(document.scripts.length).toBe(before);
  expect(window.gtag).toBeUndefined();
});
