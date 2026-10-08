import { EmptyState } from "@workspaces/ui";
import type { ReactNode } from "react";

type StatusPageProps = {
  indicator: ReactNode;
  title: string;
  description: ReactNode;
  /** The ways out: links or buttons. */
  children: ReactNode;
};

/** A page that stands in for one that cannot be shown: the page not found, or an error. */
export function StatusPage({ indicator, title, description, children }: StatusPageProps) {
  return (
    <EmptyState.Root
      as="main"
      px="4"
      py="16"
      indicator={indicator}
      title={title}
      titleProps={{ as: "h1" }}
      description={description}
    >
      {children}
    </EmptyState.Root>
  );
}
