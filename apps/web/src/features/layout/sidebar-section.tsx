import { Card, Heading } from "@workspaces/ui";
import { type ReactNode, useId } from "react";

type SidebarSectionProps = {
  title: string;
  /** The anchor a link can jump to (`/#notices`). */
  id?: string;
  children: ReactNode;
};

/** One section of the sidebar: a card with a heading. */
export function SidebarSection({ title, id, children }: SidebarSectionProps) {
  const headingId = useId();
  return (
    <Card.Root as="section" id={id} aria-labelledby={headingId}>
      <Card.Header>
        <Heading as="h2" id={headingId} fontSize="md">
          {title}
        </Heading>
      </Card.Header>
      <Card.Body alignItems="stretch">{children}</Card.Body>
    </Card.Root>
  );
}
