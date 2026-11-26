import { Box, Link, VStack, dataAttr } from "@workspaces/ui";
import { useEffect, useState } from "react";
import { SidebarSection } from "#/routes/-sidebar/sidebar-section.tsx";

/** A section heading counts as the one being read once its top is this far from the window's top. */
const READING_LINE = 96;

/** A heading in the contents: a section (`##`) or a subsection (`###`) under the one before it. */
export type GuideSection = { title: string; level: 2 | 3 };

/** The article's sections and subsections, in order. A heading's id is its text. */
export function guideSections(body: string): GuideSection[] {
  return [...body.matchAll(/^(##|###) (.+)$/gm)].map(([, marks = "", heading = ""]) => ({
    title: heading.trim(),
    level: marks === "##" ? 2 : 3,
  }));
}

/** How far a heading's link is indented, by its level. */
const INDENT = { 2: "3", 3: "6" } as const;

/**
 * The article's Markdown split before its first section: the introduction, then the sections.
 * The contents go between them on a narrow screen.
 */
export function splitIntroduction(body: string): [string, string] {
  const start = body.search(/^## /m);
  return start === -1 ? [body, ""] : [body.slice(0, start), body.slice(start)];
}

/** The section being read: the last one whose heading has reached the reading line. */
function useSectionBeingRead(sections: GuideSection[]) {
  const [current, setCurrent] = useState<string>();
  useEffect(() => {
    const update = () => {
      const reached = sections.filter(({ title }) => {
        const heading = document.getElementById(title);
        return heading !== null && heading.getBoundingClientRect().top <= READING_LINE;
      });
      setCurrent(reached.at(-1)?.title);
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
  sections: GuideSection[];
  markReading?: boolean;
}) {
  const reached = useSectionBeingRead(sections);
  const current = markReading ? reached : undefined;
  return (
    <SidebarSection title="目次">
      <VStack
        as="ol"
        gap="0"
        alignItems="stretch"
        listStyleType="none"
        data-mark-reading={dataAttr(markReading)}
      >
        {sections.map(({ title, level }) => {
          const reading = title === current;
          return (
            // The line is on the row, not the link, so the link's rounded corners leave it straight.
            <Box
              as="li"
              key={title}
              ps={INDENT[level]}
              borderLeftWidth="2px"
              borderColor="border"
              data-current={dataAttr(reading)}
              _current={{ borderColor: "primary.solid" }}
            >
              <Link
                href={`#${title}`}
                colorScheme="mono"
                display="block"
                py="1.5"
                color="fg"
                fontWeight="normal"
                _current={{ fontWeight: "bold" }}
                css={{ "[data-mark-reading] &": { _notCurrent: { color: "fg.muted" } } }}
                aria-current={reading ? "location" : undefined}
              >
                {title}
              </Link>
            </Box>
          );
        })}
      </VStack>
    </SidebarSection>
  );
}
