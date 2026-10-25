import { expect, test } from "vitest";
import { CURRENT_SCHEMA_VERSION, type Migration, migrateRow, seedRows } from "./index";

const list: Migration[] = [
  { to: 2, stores: { plans: (r) => ({ ...(r as object), a: 1 }) } },
  {
    to: 3,
    stores: {
      plans: (r) => ({ ...(r as object), b: 2 }),
      shops: (r) => ({ ...(r as object), c: 3 }),
    },
  },
];

test("applies migrations after fromVersion in order", () => {
  expect(migrateRow("plans", {}, 1, list)).toEqual({ a: 1, b: 2 });
});

test("skips migrations already applied", () => {
  expect(migrateRow("plans", {}, 2, list)).toEqual({ b: 2 });
});

test("passes through stores without a transform", () => {
  expect(migrateRow("shops", {}, 1, list)).toEqual({ c: 3 });
});

test("current version has no pending migrations", () => {
  expect(migrateRow("plans", { x: 1 }, CURRENT_SCHEMA_VERSION)).toEqual({ x: 1 });
});

test("a seed gets the rows migrated up to just before its version", () => {
  const seeding: Migration[] = [
    ...list,
    {
      to: 4,
      stores: { plans: (r) => ({ ...(r as object), d: 4 }) },
      seed: { store: "spuMonths", rows: ({ plans, profile }) => [{ plans, profile }] },
    },
  ];
  expect(seedRows({ plans: [{}], profile: undefined }, 1, seeding)).toEqual({
    spuMonths: [{ plans: [{ a: 1, b: 2 }], profile: undefined }],
  });
  expect(seedRows({ plans: [{}], profile: undefined }, 4, seeding)).toEqual({});
});
