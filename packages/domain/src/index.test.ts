import { expect, test } from "vitest";
import * as domain from "./index";

test("domain package loads", () => {
  expect(domain).toBeTypeOf("object");
});
