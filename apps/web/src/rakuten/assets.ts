/** Rakuten's page where users check their own SPU. */
export const SPU_PAGE_URL = "https://event.rakuten.co.jp/campaign/point-up/everyday/point/";

/** Rakuten's service and campaign images are served from R2, not kept in the repository. */
const IMAGE_ORIGIN = "https://assets.bmth.dev/point-sprint";

/** A benefit's `imagePath` (`/img/...`) → the URL its image is served from. */
export const imageUrl = (imagePath: string) => `${IMAGE_ORIGIN}${imagePath}`;
