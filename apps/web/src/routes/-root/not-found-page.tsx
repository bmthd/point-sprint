import { SearchXIcon } from "@workspaces/ui";
import { RouterButton } from "../../ui/router-link";
import { StatusPage } from "./status-page";

export const notFoundTitle = "ページが見つかりません";

/**
 * What a URL no route matches shows, between the site's header and footer. The plans are listed on
 * the top page: `/plan` without a plan's ID shows nothing to open.
 */
export function NotFoundPage() {
  return (
    <StatusPage
      indicator={<SearchXIcon />}
      title={notFoundTitle}
      description="お探しのページは移動したか、削除された可能性があります。URL をお確かめください。"
    >
      <RouterButton to="/" colorScheme="primary" size="lg">
        トップに戻る
      </RouterButton>
    </StatusPage>
  );
}
