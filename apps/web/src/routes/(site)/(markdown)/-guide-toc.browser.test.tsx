import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { GuideToc } from "./-guide-toc.tsx";

test("marks the section being read as its heading reaches the reading line on scroll", async () => {
  const sections = [
    { title: "最初の節", level: 2 },
    { title: "次の節", level: 2 },
  ] satisfies Parameters<typeof GuideToc>[0]["sections"];
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <GuideToc sections={sections} markReading />
      <div style={{ height: "100vh" }} />
      {sections.map(({ title }) => (
        <section key={title} style={{ height: "100vh" }}>
          <h2 id={title}>{title}</h2>
        </section>
      ))}
    </UIProvider>,
  );
  try {
    window.scrollTo(0, 0);
    const first = screen.getByRole("link", { name: "最初の節" });
    const second = screen.getByRole("link", { name: "次の節" });
    await expect.element(first).not.toHaveAttribute("aria-current");
    await expect.element(second).not.toHaveAttribute("aria-current");

    screen.getByRole("heading", { name: "最初の節" }).element().scrollIntoView();
    await expect.element(first).toHaveAttribute("aria-current", "location");
    await expect.element(second).not.toHaveAttribute("aria-current");

    screen.getByRole("heading", { name: "次の節" }).element().scrollIntoView();
    await expect.element(second).toHaveAttribute("aria-current", "location");
    await expect.element(first).not.toHaveAttribute("aria-current");
  } finally {
    window.scrollTo(0, 0);
  }
});
