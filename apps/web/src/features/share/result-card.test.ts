import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { cardGlyphs } from "./card-glyphs";
import {
  planFigures,
  resultCard,
  resultFigures,
  resultImagePath,
  resultImageRequest,
  resultPageUrl,
  resultSearchSchema,
  resultSummary,
} from "./result-card";

const parse = (search: Record<string, unknown>) =>
  resultFigures(v.parse(resultSearchSchema, search));

describe("the figures of a shared result", () => {
  test("come from the router's numbers and from plain query strings alike", () => {
    expect(parse({ points: 2600, rate: 6.5 })).toEqual({ points: 2600, rate: 6.5 });
    expect(parse({ points: "2600", rate: "6.5" })).toEqual({ points: 2600, rate: 6.5 });
  });

  test("leave out a rate that is missing or out of range", () => {
    expect(parse({ points: "2600" })).toEqual({ points: 2600 });
    expect(parse({ points: "2600", rate: "120" })).toEqual({ points: 2600 });
    expect(parse({ points: "2600", rate: "abc" })).toEqual({ points: 2600 });
  });

  test("are missing without whole, non-negative points", () => {
    expect(parse({})).toBeUndefined();
    expect(parse({ points: "-1" })).toBeUndefined();
    expect(parse({ points: "1.5" })).toBeUndefined();
    expect(parse({ points: "" })).toBeUndefined();
    expect(parse({ points: "1e3" })).toBeUndefined();
  });

  test("of a plan drop the rate while nothing is bought", () => {
    expect(planFigures(2600, "6.5")).toEqual({ points: 2600, rate: 6.5 });
    expect(planFigures(0, "—")).toEqual({ points: 0 });
  });
});

describe("a shared result's links", () => {
  test("carry the figures, the rate with one decimal", () => {
    expect(resultPageUrl({ points: 2600, rate: 6 })).toBe(
      "https://point-sprint.bmth.dev/share?points=2600&rate=6.0",
    );
    expect(resultImagePath({ points: 2600 })).toBe("/share/image.png?points=2600");
  });

  test("read back as the same figures", () => {
    const figures = { points: 12345, rate: 7.3 };
    const search = Object.fromEntries(new URL(resultPageUrl(figures)).searchParams);
    expect(parse(search)).toEqual(figures);
  });
});

describe("a request for a result's image", () => {
  const request = (pathAndQuery: string) =>
    resultImageRequest(new URL(pathAndQuery, "https://point-sprint.bmth.dev"));

  test("at the image's own path keeps that path", () => {
    for (const path of ["/share/image.png?points=2600&rate=6.5", "/share/image.png?points=0"]) {
      expect(request(path)?.path).toBe(path);
    }
  });

  test("spelt any other way is given the one path of its image", () => {
    const canonical = "/share/image.png?points=2600&rate=6.5";
    for (const path of [
      "/share/image.png?points=2600&rate=6.50001",
      "/share/image.png?points=0002600&rate=6.5",
      "/share/image.png?rate=6.5&points=2600",
      "/share/image.png?points=2600&rate=6.5&x=1",
      "/share/image.png?points=2600.0&rate=06.5",
    ]) {
      expect(request(path)?.path).toBe(canonical);
    }
    expect(request("/share/image.png?points=2600&rate=abc")?.path).toBe(
      "/share/image.png?points=2600",
    );
  });

  test("reaches a path that is its own after one step", () => {
    const first = request("/share/image.png?points=1&rate=99.96");
    expect(first?.path).toBe("/share/image.png?points=1&rate=100.0");
    expect(request(first!.path)?.path).toBe(first?.path);
  });

  test("without points has no image", () => {
    expect(request("/share/image.png")).toBeUndefined();
    expect(request("/share/image.png?rate=6.5")).toBeUndefined();
  });
});

test("the summary has the points and, when there is one, the rate", () => {
  expect(resultSummary({ points: 2600, rate: 6.5 })).toBe("獲得予定 2,600P・実質還元率 6.5%");
  expect(resultSummary({ points: 0 })).toBe("獲得予定 0P");
});

/** The text of every text node in a card. */
const texts = (node: unknown): string[] => {
  if (typeof node !== "object" || node === null) return [];
  const { text, children } = node as { text?: string; children?: unknown[] };
  return [...(text === undefined ? [] : [text]), ...(children ?? []).flatMap(texts)];
};

describe("the card", () => {
  const card = resultCard({ points: 1234567, rate: 10.5 });

  test("shows the points and the rate", () => {
    expect(texts(card)).toEqual(expect.arrayContaining(["1,234,567P", "10.5%"]));
    expect(texts(resultCard({ points: 0 }))).not.toContain("実質還元率");
  });

  test("draws only letters the fonts are cut down to", () => {
    const missing = [...texts(card).join("")].filter((c) => !cardGlyphs.includes(c));
    expect(missing).toEqual([]);
  });
});
