import { Card, Heading, VStack } from "@workspaces/ui";
import { type ReactNode, createContext, useContext, useId } from "react";
import { ColumnHead } from "#/ui/column-head.tsx";

/**
 * Where the sidebar is: a column beside the page on a wide screen, or the header's menu below the
 * `lg` breakpoint.
 */
export const SidebarPlacement = createContext<"column" | "menu">("column");

/** Whether the section is in the header's menu, not the column beside the page. */
export function useInMenu() {
  return useContext(SidebarPlacement) === "menu";
}

type SidebarSectionProps = {
  title: string;
  children: ReactNode;
};

/**
 * One section of the sidebar: a heading over its content. In the column, the content is on a card,
 * as the sections of `main` are, so the sidebar's first heading lines up with the page's. In the
 * menu, a line above the heading parts it from the section before, and the content has no card.
 */
export function SidebarSection({ title, children }: SidebarSectionProps) {
  const headingId = useId();
  const inMenu = useInMenu();
  return (
    <VStack
      as="section"
      aria-labelledby={headingId}
      gap={inMenu ? "0" : "2.5"}
      alignItems="stretch"
      {...(inMenu && { borderTopWidth: "1px", borderColor: "border", pt: "1" })}
    >
      <ColumnHead>
        <Heading as="h2" id={headingId} fontSize="md">
          {title}
        </Heading>
      </ColumnHead>
      {inMenu ? (
        <VStack gap="md" alignItems="stretch">
          {children}
        </VStack>
      ) : (
        <Card.Root>
          <Card.Body alignItems="stretch">{children}</Card.Body>
        </Card.Root>
      )}
    </VStack>
  );
}
