import { expect, test } from "vitest";
import {
  type Notice,
  isFreshRelease,
  latestRelease,
  newestFirst,
  nextVersion,
  notices,
  paragraphs,
  releasesOldestFirst,
} from "./notices";

const notice = (date: string, title: string): Notice => ({ id: title, date, title, body: "" });

test("newestFirst puts the latest notice first and keeps the listed order within a day", () => {
  const sorted = newestFirst([
    notice("2026-10-01", "古い"),
    notice("2026-11-03", "新しい"),
    notice("2026-10-15", "同じ日の1つ目"),
    notice("2026-10-15", "同じ日の2つ目"),
  ]);
  expect(sorted.map((n) => n.title)).toEqual(["新しい", "同じ日の1つ目", "同じ日の2つ目", "古い"]);
});

test("paragraphs splits the body on blank lines", () => {
  expect(paragraphs("1つ目\nの続き\n\n2つ目\n  \n3つ目\n")).toEqual([
    "1つ目\nの続き",
    "2つ目",
    "3つ目",
  ]);
});

test.each(notices)(
  "the notice $title has a real date, a title and a body",
  ({ id, date, title, body }) => {
    expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(date);
    expect(title.trim()).not.toBe("");
    expect(paragraphs(body).length).toBeGreaterThan(0);
  },
);

test("every notice has its own id", () => {
  expect(new Set(notices.map((n) => n.id)).size).toBe(notices.length);
});

const release = (date: string, version: string, changesCalculation = false): Notice => ({
  ...notice(date, `Ver.${version}`),
  release: { version, changesCalculation },
});

test("nextVersion starts at 1.0, then raises the major number only when the calculation changes", () => {
  expect(nextVersion(undefined, false)).toBe("1.0");
  expect(nextVersion(undefined, true)).toBe("1.0");
  expect(nextVersion("1.4", false)).toBe("1.5");
  expect(nextVersion("1.9", false)).toBe("1.10");
  expect(nextVersion("1.4", true)).toBe("2.0");
});

test("latestRelease is the highest version, skipping notices without one", () => {
  const list = [
    release("2026-10-01", "1.9"),
    notice("2026-12-01", "版のないお知らせ"),
    release("2026-11-01", "1.10"),
  ];
  expect(latestRelease(list)?.release.version).toBe("1.10");
  expect(latestRelease([notice("2026-10-01", "版のないお知らせ")])).toBeUndefined();
});

test("a release stays fresh for 30 days", () => {
  const latest = latestRelease([release("2026-10-25", "1.0")]);
  if (latest === undefined) throw new Error("no release");
  expect(isFreshRelease(latest, "2026-10-25")).toBe(true);
  expect(isFreshRelease(latest, "2026-11-24")).toBe(true);
  expect(isFreshRelease(latest, "2026-11-25")).toBe(false);
});

test("each release raises the version from the one before it", () => {
  const releases = releasesOldestFirst(notices);
  expect(releases.length).toBeGreaterThan(0);
  releases.reduce<string | undefined>((previous, { release: { version, changesCalculation } }) => {
    expect(version).toBe(nextVersion(previous, changesCalculation));
    return version;
  }, undefined);
});

test("releases are dated in the order of their versions", () => {
  const dates = releasesOldestFirst(notices).map((n) => n.date);
  expect(dates).toEqual(dates.toSorted());
});
