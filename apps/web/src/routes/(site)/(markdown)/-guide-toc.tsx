import { Box, Link, VStack } from "@workspaces/ui";
import { useEffect, useState } from "react";
import { SidebarSection } from "../../-sidebar/sidebar-section";

/** A section heading counts as the one being read once its top is this far from the window's top. */
const READING_LINE = 96;

/** The article's sections (its `##` headings), in order. A heading's id is its text. */
export function guideSections(body: string) {
  return [...body.matchAll(/^## (.+)$/gm)].map(([, heading = ""]) => heading.trim());
}

/**
 * The article's Markdown split before its first section: the introduction, then the sections.
 * The contents go between them on a narrow screen.
 */
export function splitIntroduction(body: string): [string, string] {
  const start = body.search(/^## /m);
  return start === -1 ? [body, ""] : [body.slice(0, start), body.slice(start)];
}

/** The section being read: the last one whose heading has reached the reading line. */
function useSectionBeingRead(sections: string[]) {
  const [current, setCurrent] = useState<string>();
  useEffect(() => {
    const update = () => {
      const reached = sections.filter((section) => {
        const heading = document.getElementById(section);
        return heading !== null && heading.getBoundingClientRect().top <= READING_LINE;
      });
      setCurrent(reached.at(-1));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [sections]);
  return current;
}

/**
 * The contents of a shopping guide: a link to each section. With `markReading`, the one being read
 * is marked and the others are muted; without it, every link is in the text's color.
 */
export function GuideToc({
  sections,
  markReading = false,
}: {
  sections: string[];
  markReading?: boolean;
}) {
  const reached = useSectionBeingRead(sections);
  const current = markReading ? reached : undefined;
  return (
    <SidebarSection title="目次">
      <VStack as="ol" gap="0" alignItems="stretch" listStyleType="none">
        {sections.map((section) => {
          const reading = section === current;
          return (
            <Box as="li" key={section}>
              <Link
                href={`#${section}`}
                colorScheme="mono"
                display="block"
                py="1.5"
                ps="3"
                borderLeftWidth="2px"
                borderColor={reading ? "primary.solid" : "border"}
                color={!markReading || reading ? "fg" : "fg.muted"}
                fontWeight={reading ? "bold" : "normal"}
                aria-current={reading ? "location" : undefined}
              >
                {section}
              </Link>
            </Box>
          );
        })}
      </VStack>
    </SidebarSection>
  );
}
