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
import { cleanup, render } from "vitest-browser-react";
import { figureExtension } from "./figure-extension.ts";
import { helpFigures } from "./figures.tsx";
import { HelpFigure } from "./help-figure.tsx";

/** The figure on a page of its own, under a router as on the help: some components link. */
async function renderFigure(name: string) {
  await cleanup();
  const root = createRootRoute({ component: () => <HelpFigure name={name} /> });
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
  await expect.element(screen.getByRole("img", { name: spec.label })).toBeInTheDocument();
  const figure = screen.container.querySelector(`[data-help-figure="${spec.name}"]`);
  for (const mark of spec.marks) {
    const found = figure?.querySelectorAll(mark.selector) ?? [];
    expect(found, mark.selector).toHaveLength(1);
    expect(found[0]?.textContent, mark.selector).toContain(mark.text);
  }
});

test.each(Object.values(helpFigures))("no box inside $name clips a mark's number", async (spec) => {
  const screen = await renderFigure(spec.name);
  await expect.element(screen.getByRole("img", { name: spec.label })).toBeInTheDocument();
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

test("figure directives pass their name attribute and numbered explanations", () => {
  const parsed = parseMarkdown(':::figure{name="plan"}\n1. 注文はプランごとに保存されます。\n:::', {
    extensions: [figureExtension],
  });
  expect(parsed.children[0]).toMatchObject({
    tagName: "md-figure",
    properties: { name: "plan" },
    children: [{ tagName: "md-figure-callout", properties: { step: "1" } }],
  });
});

test.each([
  [":::figure plan\n1. 説明\n:::", /Use :::figure/],
  [':::figure{name="missing"}\n1. 説明\n:::', /has no figure/],
  [':::figure{name="plan"}\n1. 説明', /has no closing/],
  [':::figure{name="plan"}\n本文\n:::', /numbered list/],
  [':::figure{name="plan"}\n1. 説明\n2. 説明\n:::', /marks but/],
])("invalid figure directive fails: %s", (source, error) => {
  expect(() => parseMarkdown(source, { extensions: [figureExtension] })).toThrow(error);
});

test("October's SPU figure shows both marked sections completely", async () => {
  const spec = helpFigures["spu-month-top"];
  if (!spec) throw new Error("Missing October SPU figure");
  const screen = await renderFigure(spec.name);
  await expect.element(screen.getByRole("img", { name: spec.label })).toBeInTheDocument();
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
