declare module "virtual:guide-items" {
  /** The items of the guides' lists, fetched by the build (`vite-plugin.ts`). */
  const guideItems: import("./guide-items").GuideItems;
  export default guideItems;
}
