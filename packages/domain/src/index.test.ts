import { expect, test } from "vitest";
import * as domain from "./index.ts";

test("domain package loads", () => {
  expect(domain).toBeTypeOf("object");
});
