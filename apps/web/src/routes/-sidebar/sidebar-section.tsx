import { Card, Heading, VStack } from "@workspaces/ui";
import { type ReactNode, useId } from "react";
import { ColumnHead } from "../../ui/column-head";

type SidebarSectionProps = {
  title: string;
  children: ReactNode;
};

/**
 * One section of the sidebar: a heading over a card, as the sections of `main` are, so the
 * sidebar's first heading lines up with the page's.
 */
export function SidebarSection({ title, children }: SidebarSectionProps) {
  const headingId = useId();
  return (
    <VStack as="section" aria-labelledby={headingId} gap="2.5" alignItems="stretch">
      <ColumnHead>
        <Heading as="h2" id={headingId} fontSize="md">
          {title}
        </Heading>
      </ColumnHead>
      <Card.Root>
        <Card.Body alignItems="stretch">{children}</Card.Body>
      </Card.Root>
    </VStack>
  );
}
