import type { ReactNode } from "react";

function Icon({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ChevronIcon({ open = false, size = 18 }: { open?: boolean; size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        flex: "none",
        transition: "transform .15s",
        transform: open ? "rotate(180deg)" : undefined,
      }}
    >
      <Icon size={size}>
        <path d="m6 9 6 6 6-6" />
      </Icon>
    </span>
  );
}

export function SlidersIcon() {
  return (
    <Icon size={22}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Icon>
  );
}

export function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function ArrowIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <Icon size={20}>
      <path d={direction === "up" ? "M12 19V5M5 12l7-7 7 7" : "M12 5v14M5 12l7 7 7-7"} />
    </Icon>
  );
}

/** The dotted grip of a drag handle. */
export function GripIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor" aria-hidden="true">
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="10" cy="4" r="1.5" />
      <circle cx="4" cy="9" r="1.5" />
      <circle cx="10" cy="9" r="1.5" />
      <circle cx="4" cy="14" r="1.5" />
      <circle cx="10" cy="14" r="1.5" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <Icon size={20}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  );
}

export function BackIcon() {
  return (
    <Icon size={22}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  );
}

export function PencilIcon() {
  return (
    <Icon size={16}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Icon>
  );
}

export function CheckIcon() {
  return (
    <Icon size={14}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function ExternalIcon() {
  return (
    <Icon size={14}>
      <path d="M7 17 17 7M8 7h9v9" />
    </Icon>
  );
}
