import { ShareLinks } from "#/routes/-share/share-button.tsx";
import { siteShareTarget } from "#/routes/-share/share-target.ts";
import { SidebarSection } from "./sidebar-section";

/** Sharing the site: the links to each service are out from the start, nothing to open first. */
export function ShareSection() {
  return (
    <SidebarSection title="このサイトをシェア">
      <ShareLinks target={siteShareTarget} />
    </SidebarSection>
  );
}
