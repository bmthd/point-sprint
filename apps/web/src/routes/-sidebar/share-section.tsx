import { ShareLinkRows, ShareLinks } from "#/routes/-share/share-button.tsx";
import { siteShareTarget } from "#/routes/-share/share-target.ts";
import { SidebarSection, useInMenu } from "./sidebar-section.tsx";

/**
 * Sharing the site: the links to each service are out from the start, nothing to open first. In
 * the column they are a row of logos; in the menu, a line each, as the menu's other links are.
 */
export function ShareSection() {
  const inMenu = useInMenu();
  return (
    <SidebarSection title="このサイトをシェア">
      {inMenu ? (
        <ShareLinkRows target={siteShareTarget} />
      ) : (
        <ShareLinks target={siteShareTarget} />
      )}
    </SidebarSection>
  );
}
