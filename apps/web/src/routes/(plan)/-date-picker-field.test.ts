import { describe, expect, test } from "vitest";
import { parseTypedDate } from "./-date-picker-field.tsx";

describe("parseTypedDate", () => {
  test("reads a day with slashes and with hyphens as the same day", () => {
    expect(parseTypedDate("2026/11/20")).toEqual(new Date(2026, 10, 20));
    expect(parseTypedDate("2026-11-20")).toEqual(new Date(2026, 10, 20));
  });

  test("reads one-digit months and days", () => {
    expect(parseTypedDate("2026/1/5")).toEqual(new Date(2026, 0, 5));
    expect(parseTypedDate("2026-1-5")).toEqual(new Date(2026, 0, 5));
  });

  test("reads full-width digits as half-width ones", () => {
    expect(parseTypedDate("２０２６/１１/２０")).toEqual(new Date(2026, 10, 20));
  });

  test("reads a leap day only in a leap year", () => {
    expect(parseTypedDate("2024/02/29")).toEqual(new Date(2024, 1, 29));
    expect(parseTypedDate("2026/02/29")).toBeUndefined();
  });

  test("a day still being typed is not read as another day", () => {
    // The picker's own reading turns the first keystroke `2` into 2001/02/01.
    for (const text of ["2", "20", "202", "2026", "2026/", "2026/1", "2026/11/", "2026/11/2x"]) {
      expect(parseTypedDate(text)).toBeUndefined();
    }
  });

  test("a day that does not exist is not read as another day", () => {
    for (const text of ["2026/13/01", "2026/00/10", "2026/02/30", "2026/04/31", "2026/11/00"]) {
      expect(parseTypedDate(text)).toBeUndefined();
    }
  });

  test("text that is not a day is not read", () => {
    for (const text of ["", " ", "2026/11", "11/20/2026", "2026.11.20", "20261120", "abc"]) {
      expect(parseTypedDate(text)).toBeUndefined();
    }
  });
});
