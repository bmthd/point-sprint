import { Tag, Wrap, type WrapProps } from "@workspaces/ui";
import type { GuideTag } from "#/guides/article.ts";

/** What kind of article a guide is, as display-only chips: they lead nowhere yet. */
export function GuideTags({ tags, ...props }: { tags: readonly GuideTag[] } & WrapProps) {
  return (
    <Wrap as="ul" gap="1.5" aria-label="タグ" {...props}>
      {tags.map((tag) => (
        <Tag as="li" key={tag} size="sm" variant="outline" fullRounded>
          {tag}
        </Tag>
      ))}
    </Wrap>
  );
}
