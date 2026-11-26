import { Markdown } from "@tanstack/markdown/react";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { markdownComponents } from "./-markdown-body.tsx";

test("an image line is a lazily loaded image with the Markdown's alternative text", async () => {
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <Markdown components={markdownComponents}>
        {"![計算の結果](/guides/how-much-to-buy/result.png)"}
      </Markdown>
    </UIProvider>,
  );

  const image = screen.getByRole("img", { name: "計算の結果" });
  await expect.element(image).toHaveAttribute("src", "/guides/how-much-to-buy/result.png");
  await expect.element(image).toHaveAttribute("loading", "lazy");
  await expect.element(image).toHaveAttribute("decoding", "async");
});

function renderTable(width: string, columns: number) {
  const head = Array.from({ length: columns }, (_, index) => `列${index + 1}の見出し`);
  const table = [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    `| ${head.map(() => "○").join(" | ")} |`,
  ].join("\n");
  return render(
    <UIProvider theme={theme} config={config}>
      <div style={{ width }}>
        <Markdown components={markdownComponents}>{table}</Markdown>
      </div>
    </UIProvider>,
  );
}

test("a table wider than its column shows it can scroll right, and only left once scrolled to the end", async () => {
  const screen = await renderTable("240px", 8);
  const frame = screen.container.querySelector("table")?.parentElement?.parentElement;
  if (!frame) throw new Error("The table has no frame.");

  await expect.poll(() => frame.hasAttribute("data-can-scroll-right")).toBe(true);
  expect(frame.hasAttribute("data-can-scroll-left")).toBe(false);

  const box = frame.querySelector("table")?.parentElement;
  if (!box) throw new Error("The table has no scrolling box.");
  box.scrollLeft = box.scrollWidth;

  await expect.poll(() => frame.hasAttribute("data-can-scroll-left")).toBe(true);
  expect(frame.hasAttribute("data-can-scroll-right")).toBe(false);
});

test("a table that fits its column shows no way to scroll", async () => {
  const screen = await renderTable("800px", 2);
  const frame = screen.container.querySelector("table")?.parentElement?.parentElement;
  if (!frame) throw new Error("The table has no frame.");

  // Give the measuring a moment to run after mounting.
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(frame.hasAttribute("data-can-scroll-right")).toBe(false);
  expect(frame.hasAttribute("data-can-scroll-left")).toBe(false);
});
