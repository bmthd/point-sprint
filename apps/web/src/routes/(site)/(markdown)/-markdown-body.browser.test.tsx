import { Markdown } from "@tanstack/markdown/react";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { markdownComponents } from "./-markdown-body";

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
