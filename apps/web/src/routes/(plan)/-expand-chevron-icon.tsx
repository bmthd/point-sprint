import { ChevronDownIcon, dataAttr } from "@workspaces/ui";

/** A chevron that turns upside down while the section it toggles is open. */
export function ExpandChevronIcon({ open }: { open: boolean }) {
  return (
    <ChevronDownIcon
      data-open={dataAttr(open)}
      boxSize="4.5"
      transitionProperty="rotate"
      transitionDuration="0.15s"
      _open={{ rotate: "180deg" }}
    />
  );
}
