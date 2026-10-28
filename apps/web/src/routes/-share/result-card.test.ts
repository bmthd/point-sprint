import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { cardGlyphs } from "./card-glyphs";
import {
  eventKindOf,
  planFigures,
  resultCard,
  resultFigures,
  resultImagePath,
  resultPageUrl,
  ResultSearchSchema,
  resultSummary,
} from "./result-card";
import { siteUrl } from "../../site-url";

const breakdown = { base: 100, spu: 500, marathon: 1000, campaign: 1000 };

const parse = (search: Record<string, unknown>) =>
  resultFigures(v.parse(ResultSearchSchema, search));

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

  test("keep a breakdown that adds up to the points, with the event", () => {
    expect(
      parse({
        points: "2600",
        rate: "6.5",
        base: "100",
        spu: "500",
        marathon: "1000",
        campaign: "1000",
        event: "marathon",
      }),
    ).toEqual({ points: 2600, rate: 6.5, breakdown, event: "marathon" });
  });

  test("drop a breakdown that does not add up, is broken or is missing a group", () => {
    const groups = { base: "100", spu: "500", marathon: "1000" };
    expect(parse({ points: "2600", ...groups, campaign: "999" })).toEqual({ points: 2600 });
    expect(parse({ points: "2600", ...groups, spu: "abc", campaign: "1000" })).toEqual({
      points: 2600,
    });
    expect(parse({ points: "2600", base: "100", marathon: "1000", campaign: "1500" })).toEqual({
      points: 2600,
    });
  });

  test("leave out an event that is not one of the kinds", () => {
    expect(parse({ points: "2600", event: "<script>" })).toEqual({ points: 2600 });
  });

  test("of a plan carry its breakdown and its event's kind, and drop the rate while nothing is bought", () => {
    expect(
      planFigures({ total: 2600, groupTotals: breakdown }, "6.5", "marathon-2026-10-24"),
    ).toEqual({ points: 2600, rate: 6.5, breakdown, event: "marathon" });
    expect(
      planFigures(
        { total: 0, groupTotals: { base: 0, spu: 0, marathon: 0, campaign: 0 } },
        "—",
        undefined,
      ),
    ).toEqual({ points: 0 });
  });
});

test("an event's kind comes from the prefix of its id", () => {
  expect(eventKindOf("marathon-2026-10")).toBe("marathon");
  expect(eventKindOf("brand-day-2026-10-20")).toBe("brand-day");
  expect(eventKindOf("super-sale-2026-12-04")).toBeUndefined();
  expect(eventKindOf(undefined)).toBeUndefined();
});

describe("a shared result's links", () => {
  test("carry the figures, the rate with one decimal", () => {
    expect(resultPageUrl({ points: 2600, rate: 6 })).toBe(`${siteUrl}/share?points=2600&rate=6.0`);
    expect(resultImagePath({ points: 2600 })).toBe("/share/image.png?points=2600");
  });

  test("carry the breakdown and the event after the figures", () => {
    expect(resultImagePath({ points: 2600, rate: 6.5, breakdown, event: "marathon" })).toBe(
      "/share/image.png?points=2600&rate=6.5&base=100&spu=500&marathon=1000&campaign=1000&event=marathon",
    );
  });

  test("read back as the same figures", () => {
    for (const figures of [
      { points: 12345, rate: 7.3 },
      { points: 2600, rate: 6.5, breakdown, event: "brand-day" as const },
    ]) {
      const search = Object.fromEntries(new URL(resultPageUrl(figures)).searchParams);
      expect(parse(search)).toEqual(figures);
    }
  });
});

test("the summary has the points and, when there is one, the rate", () => {
  expect(resultSummary({ points: 2600, rate: 6.5 })).toBe("獲得ポイント 2,600P・実質還元率 6.5%");
  expect(resultSummary({ points: 0 })).toBe("獲得ポイント 0P");
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
