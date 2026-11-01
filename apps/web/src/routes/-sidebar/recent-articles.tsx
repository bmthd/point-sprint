import { getRouteApi, useMatch } from "@tanstack/react-router";
import { List, Text } from "@workspaces/ui";
import { japaneseDate } from "../../guides/article";
import { RECENT_SHOWN } from "../../guides/recent-articles";
import { RouterLink } from "../../ui/router-link";
import { SidebarSection } from "./sidebar-section";

const root = getRouteApi("__root__");

/**
 * The shopping guides changed most recently: the day and the title, each a link to the guide. On
 * a guide's page, that guide is left out.
 */
export function RecentArticles() {
  const articles = root.useLoaderData({ select: (data) => data.recentArticles });
  const current = useMatch({
    from: "/(site)/(markdown)/guides/$slug",
    shouldThrow: false,
    select: (match) => match.params.slug,
  });
  const shown = articles.filter((article) => article.slug !== current).slice(0, RECENT_SHOWN);
  if (shown.length === 0) return null;
  return (
    <SidebarSection title="最近更新された記事">
      <List.Root gap="3">
        {shown.map((article) => (
          <List.Item
            key={article.slug}
            display="flex"
            flexDirection="column"
            gap="0.5"
            alignItems="start"
          >
            <Text as="time" dateTime={article.date} fontSize="xs" color="fg.muted">
              {japaneseDate(article.date)}
            </Text>
            <RouterLink
              to="/guides/$slug"
              params={{ slug: article.slug }}
              fontSize="sm"
              color="link"
            >
              {article.title}
            </RouterLink>
          </List.Item>
        ))}
      </List.Root>
      <RouterLink to="/guides" fontSize="sm" color="link" alignSelf="end">
        すべての記事
      </RouterLink>
    </SidebarSection>
  );
}
