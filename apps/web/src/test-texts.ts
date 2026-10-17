import { expect } from "vitest";
import type { Locator } from "vitest/browser";

/** Expects `locator` to match one element per text, in this order, each with exactly that text. */
export async function expectTexts(locator: Locator, texts: readonly string[]) {
  await expect.element(locator).toHaveLength(texts.length);
  for (const [index, text] of texts.entries()) {
    await expect.element(locator.nth(index)).toHaveTextContent(text);
  }
}
