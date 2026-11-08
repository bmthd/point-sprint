import { Card, Image, type ImageProps, LinkBox } from "@workspaces/ui";
import type { Article } from "#/guides/article.ts";
import { thumbnailPath, thumbnailSize } from "#/guides/thumbnail.ts";

/**
 * A guide's thumbnail, at its own proportions whatever width it is given. Its text is the guide's
 * title when the picture is the link, and none when a title beside it names the link.
 */
export function GuideThumbnail({
  slug,
  alt,
  ...props
}: { slug: string; alt: string } & ImageProps) {
  return (
    <Image
      src={thumbnailPath(slug)}
      alt={alt}
      w="full"
      aspectRatio={`${thumbnailSize.width} / ${thumbnailSize.height}`}
      loading="lazy"
      {...props}
    />
  );
}

/**
 * A guide's card in a list: its thumbnail alone, linking to it. The thumbnail carries the guide's
 * title in its picture, so the card has no text but the picture's `alt`.
 */
export function GuideCard({ article }: { article: Pick<Article, "slug" | "title"> }) {
  return (
    <LinkBox.Root as="li">
      <Card.Root overflow="hidden">
        {/* A link that loads the page, not one the router follows: the guide's items are in its
            prerendered HTML only (`getGuide`). */}
        <LinkBox.Overlay href={`/guides/${article.slug}`}>
          <GuideThumbnail slug={article.slug} alt={article.title} display="block" />
        </LinkBox.Overlay>
      </Card.Root>
    </LinkBox.Root>
  );
}
