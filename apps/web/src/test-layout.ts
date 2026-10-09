/** The box of a `DatePicker`, around its input. */
export const DATE_PICKER_FIELD = "[role='combobox']:has(> input)";

/**
 * The text fields and selects of `root` that sit side by side but start at different heights, as
 * 「label (top) / label (top)」. A field stretched to the height of an error beside it moves its
 * input down.
 */
export function misalignedFields(root: Element): string[] {
  const fields = [...root.querySelectorAll<HTMLElement>("input:not([type=checkbox]), select")]
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
