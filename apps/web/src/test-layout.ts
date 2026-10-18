/** The box of a `DatePicker`, around its input. */
export const DATE_PICKER_FIELD = "[role='combobox']:has(> input)";

/**
 * The text fields and selects of `root` that sit side by side but start at different heights, as
 * 「label (top) / label (top)」. A field stretched to the height of an error beside it moves its
 * input down.
 */
export function misalignedFields(root: Element): string[] {
  const fields = [
    ...root.querySelectorAll<HTMLElement>("input:not([type=checkbox], [type=radio]), select"),
  ]
    .filter((element) => element.offsetParent !== null)
    .map((element) => ({
      name: element.getAttribute("aria-label") ?? element.id,
      label: (element as HTMLInputElement).labels?.[0]?.textContent ?? "",
      // A date picker's input sits in the middle of its box, which lines up with the other fields.
      rect: (element.closest(DATE_PICKER_FIELD) ?? element).getBoundingClientRect(),
    }));
  const misaligned: string[] = [];
  for (const [index, a] of fields.entries()) {
    for (const b of fields.slice(index + 1)) {
      const sideBySide =
        Math.min(a.rect.bottom, b.rect.bottom) > Math.max(a.rect.top, b.rect.top) &&
        (a.rect.right <= b.rect.left || b.rect.right <= a.rect.left);
      if (sideBySide && Math.abs(a.rect.top - b.rect.top) > 1) {
        misaligned.push(
          `${a.label || a.name} (${Math.round(a.rect.top)}) / ${b.label || b.name} (${Math.round(b.rect.top)})`,
        );
      }
    }
  }
  return misaligned;
}

/**
 * How wide and tall `element` can be pressed: its box, with what an absolutely placed `::before`
 * adds past it. Its insets are from inside the border, so a border is taken off what they reach.
 */
export function tapArea(element: Element): { width: number; height: number } {
  const box = element.getBoundingClientRect();
  const own = getComputedStyle(element);
  const before = getComputedStyle(element, "::before");
  if (before.position !== "absolute" || before.content === "none") {
    return { width: box.width, height: box.height };
  }
  const past = (inset: string, border: string) =>
    Math.max(0, -(Number.parseFloat(inset) || 0) - (Number.parseFloat(border) || 0));
  return {
    width:
      box.width + past(before.left, own.borderLeftWidth) + past(before.right, own.borderRightWidth),
    height:
      box.height +
      past(before.top, own.borderTopWidth) +
      past(before.bottom, own.borderBottomWidth),
  };
}
