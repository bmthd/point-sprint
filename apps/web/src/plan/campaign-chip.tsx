import { Tag } from "@workspaces/ui";
import type { ReactNode } from "react";

/** A campaign that gave the order points, as a small display-only chip. */
export function CampaignChip({ children }: { children: ReactNode }) {
  return (
    <Tag as="span" size="sm" variant="outline" fullRounded>
      {children}
    </Tag>
  );
}
