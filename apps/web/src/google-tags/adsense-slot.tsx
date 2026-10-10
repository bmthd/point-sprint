import { useEffect } from "react";
import { googleTagIds } from "./ids";

type Props = {
  /** The ad unit ID from the AdSense console. */
  slot: string;
  format?: string;
  fullWidthResponsive?: boolean;
  /** Defaults to the build's AdSense client ID; without one the slot renders nothing. */
  clientId?: string;
};

/**
 * One AdSense ad unit. It asks AdSense to fill it once, when it mounts: a slot in a layout that
 * stays mounted across routes should be keyed by the pathname to get a new ad on each page.
 */
export function AdsenseSlot({
  slot,
  format = "auto",
  fullWidthResponsive = false,
  clientId = googleTagIds.adsenseClientId,
}: Props) {
  useEffect(() => {
    if (!clientId) return;
    (window.adsbygoogle ??= []).push({});
  }, [clientId]);

  if (!clientId) return null;
  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={clientId}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={String(fullWidthResponsive)}
    />
  );
}
