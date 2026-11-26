import { parseMarkdown } from "@tanstack/markdown/parser";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { figureExtension } from "./figure-extension.ts";
import help from "#/routes/(site)/(markdown)/-markdown/help.md?raw";
import { helpFigures } from "./figures.tsx";
import { HelpFigure } from "./help-figure.tsx";

const helpNodes = parseMarkdown(help, { extensions: [figureExtension] }).children;

/** Read the same copy as the page, so Markdown-only edits are checked in the browser too. */
function figureCopy(name: string) {
  const node = helpNodes.find(
    (node) =>
      node.type === "component" && node.tagName === "md-figure" && node.properties?.name === name,
  );
  if (node?.type !== "component") throw new Error(`Missing figure ${name}`);
  const { caption, alt } = node.properties ?? {};
  if (typeof caption !== "string" || typeof alt !== "string")
    throw new Error(`Missing figure copy for ${name}`);
  return { caption, alt };
}

/**
 * The figure on a page of its own, under a router as on the help: some components link. A wide
 * figure shows only on a window as wide as the plan page's two columns.
 */
async function renderFigure(name: string) {
  await cleanup();
  await page.viewport(helpFigures[name]?.screen === "wide" ? 1470 : 390, 900);
  const root = createRootRoute({
    component: () => <HelpFigure name={name} {...figureCopy(name)} />,
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/help"] }),
  });
  return render(
    <UIProvider theme={theme} config={config}>
      <RouterProvider router={router} />
    </UIProvider>,
  );
}

test.each(Object.values(helpFigures))("each mark of $name points at what it says", async (spec) => {
  const screen = await renderFigure(spec.name);
  await expect
    .element(screen.getByRole("img", { name: figureCopy(spec.name).alt }))
    .toBeInTheDocument();
  await expect
    .element(screen.getByText(figureCopy(spec.name).caption, { exact: true }))
    .toBeInTheDocument();
  await expect.element(screen.getByText(figureCopy(spec.name).caption)).toBeInTheDocument();
  const figure = screen.container.querySelector(`[data-help-figure="${spec.name}"]`);
  for (const mark of spec.marks) {
    const found = figure?.querySelectorAll(mark.selector) ?? [];
    expect(found, mark.selector).toHaveLength(1);
    expect(found[0]?.textContent, mark.selector).toContain(mark.text);
  }
});

test.each(Object.values(helpFigures))("no box inside $name clips a mark's number", async (spec) => {
  const screen = await renderFigure(spec.name);
  await expect
    .element(screen.getByRole("img", { name: figureCopy(spec.name).alt }))
    .toBeInTheDocument();
  const figure = screen.container.querySelector(`[data-help-figure="${spec.name}"]`);
  for (const mark of spec.marks) {
    const marked = figure?.querySelector(mark.selector);
    // The figure itself may crop a long screen: the numbers stay inside its padding.
    for (let box = marked; box && box !== figure; box = box.parentElement) {
      const { overflowX, overflowY } = getComputedStyle(box);
      expect([overflowX, overflowY], `${mark.selector}: ${box.className}`).toEqual([
        "visible",
        "visible",
      ]);
    }
  }
});

test("October's SPU figure shows both marked sections completely", async () => {
  const spec = helpFigures["spu-month-top"];
  if (!spec) throw new Error("Missing October SPU figure");
  const screen = await renderFigure(spec.name);
  await expect
    .element(screen.getByRole("img", { name: figureCopy(spec.name).alt }))
    .toBeInTheDocument();
  const figure = screen.container.querySelector('[data-help-figure="spu-month-top"]');
  if (!figure?.parentElement) throw new Error("Missing figure frame");
  const frame = figure.parentElement.getBoundingClientRect();
  for (const mark of spec.marks) {
    const section = figure.querySelector(mark.selector);
    if (!section) throw new Error("Missing marked SPU section");
    const bounds = section.getBoundingClientRect();
    expect(bounds.top, mark.text).toBeGreaterThanOrEqual(frame.top);
    expect(bounds.bottom, mark.text).toBeLessThanOrEqual(frame.bottom);
  }
});
