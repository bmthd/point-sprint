import { expect, test } from "vitest";
import { figureRuns, figureSize, thumbnailAlt } from "./thumbnail.ts";

test("a figure's digits are drawn large and the words around them small", () => {
  expect(figureRuns("税抜77,778円")).toEqual([
    { text: "税抜", large: false },
    { text: "77,778", large: true },
    { text: "円", large: false },
  ]);
});

test("a figure without digits is drawn large throughout", () => {
  expect(figureRuns("順番では変わらない")).toEqual([{ text: "順番では変わらない", large: true }]);
});

test("a long figure is drawn smaller, to stay on one line", () => {
  expect(figureSize("7つ")).toBe(140);
  expect(figureSize("順番では変わらない")).toBeLessThan(140);
  expect(figureSize("順番では変わらない、どの順に買っても同じ")).toBeLessThan(
    figureSize("順番では変わらない"),
  );
});

test("the thumbnail's alt is its lead and figure, or the title without them", () => {
  expect(
    thumbnailAlt({ title: "記事", cardLead: "あと1店舗を足すなら", cardFigure: "1,000円" }),
  ).toBe("あと1店舗を足すなら 1,000円");
  expect(thumbnailAlt({ title: "記事" })).toBe("記事");
});
