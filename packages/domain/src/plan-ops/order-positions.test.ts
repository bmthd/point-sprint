import { describe, expect, test } from "vitest";
import { orderPositions } from "./order-positions";

const changedIds = (previous: ReadonlyMap<string, number>, next: ReadonlyMap<string, number>) =>
  [...next].filter(([id, position]) => previous.get(id) !== position).map(([id]) => id);

const increasing = (next: ReadonlyMap<string, number>, ids: string[]) =>
  ids.every((id, index) => index === 0 || next.get(ids[index - 1]!)! < next.get(id)!);

describe("orderPositions", () => {
  test("moving one order gives a new position to that order only", () => {
    const previous = new Map([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 3],
    ]);
    const ids = ["a", "c", "b", "d"];
    const next = orderPositions(previous, ids);
    expect(changedIds(previous, next)).toHaveLength(1);
    expect(increasing(next, ids)).toBe(true);
  });

  test("a new order goes between its neighbors", () => {
    const next = orderPositions(
      new Map([
        ["a", 1],
        ["b", 2],
      ]),
      ["a", "x", "b"],
    );
    expect(next.get("x")).toBeGreaterThan(1);
    expect(next.get("x")).toBeLessThan(2);
    expect(next.get("a")).toBe(1);
    expect(next.get("b")).toBe(2);
  });

  test("new orders at the ends and in an empty list are in order", () => {
    const ids = ["x", "a", "y", "z"];
    const next = orderPositions(new Map([["a", 5]]), ids);
    expect(next.get("a")).toBe(5);
    expect(increasing(next, ids)).toBe(true);
    expect(increasing(orderPositions(new Map(), ["p", "q"]), ["p", "q"])).toBe(true);
  });

  test("the same order keeps every position", () => {
    const previous = new Map([
      ["a", 0],
      ["b", 1],
    ]);
    expect(changedIds(previous, orderPositions(previous, ["a", "b"]))).toEqual([]);
  });

  test("only the ids given get a position", () => {
    const next = orderPositions(
      new Map([
        ["a", 0],
        ["b", 1],
      ]),
      ["b"],
    );
    expect([...next.keys()]).toEqual(["b"]);
  });
});
