import type { MarkdownExtension } from "@tanstack/markdown";
import { Markdown } from "@tanstack/markdown/react";
import { Avatar, Card, HStack, Link, List, Text, VStack, Wrap } from "@workspaces/ui";
import { otherWorks, type Profile, profileLinks } from "./profile.ts";
import {
  headingIds,
  insetCardProps,
  markdownComponents,
} from "#/routes/(site)/(markdown)/-markdown-body.tsx";
import { markdownExtensions } from "#/routes/(site)/(markdown)/-markdown-extensions.ts";

/** `:::profile` and `:::works` on a line of their own: where the profile and the works go. */
export const aboutExtension: MarkdownExtension = {
  name: "about",
  parseBlock(context) {
    const name = context.lines[context.index]?.trim().match(/^:::(profile|works)$/)?.[1];
    if (!name) return undefined;
    context.consume(1);
    return {
      type: "component",
      name,
      tagName: `md-${name}`,
      attributes: {},
      properties: {},
      children: [],
    };
  },
};

/** The about page: its Markdown, with the operator's profile and other works from the link hub. */
export function AboutPage({ markdown, profile }: { markdown: string; profile: Profile }) {
  const components = {
    ...markdownComponents,
    "md-profile": () => <ProfileCard profile={profile} />,
    "md-works": () => <WorkList profile={profile} />,
  };
  return (
    <Markdown
      components={components}
      extensions={[...markdownExtensions, aboutExtension]}
      headingIds={headingIds}
    >
      {markdown}
    </Markdown>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const [avatar] = profile.avatar;
  return (
    <Card.Root {...insetCardProps} my="lg">
      <Card.Body>
        <HStack gap="md" alignItems="center">
          <Avatar src={avatar?.url} name={profile.name.ja} size="xl" />
          <VStack gap="1" alignItems="start" minW="0">
            <Text fontWeight="bold" fontSize="lg">
              {profile.name.ja}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {profile.bio.ja}
            </Text>
            <Wrap columnGap="md" rowGap="1" fontSize="sm">
              {profileLinks(profile).map((link) => (
                <Link key={link.url} href={link.url} target="_blank" rel="me noopener" color="link">
                  {link.label}
                </Link>
              ))}
            </Wrap>
          </VStack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}

function WorkList({ profile }: { profile: Profile }) {
  return (
    <List.Root styleType="disc" my="lg" lineHeight="1.9">
      {otherWorks(profile).map((work) => (
        <List.Item key={work.url}>
          <Link href={work.url} target="_blank" rel="noopener" color="link">
            {work.label}
          </Link>
        </List.Item>
      ))}
    </List.Root>
  );
}
