/**
 * Every letter the result's OGP image (`resultCard`) can draw. The fonts are cut down to these at
 * build time (`og-fonts-plugin.ts`), so a letter added to the card must be added here too; a test
 * checks it. Kept apart from the card, which the Vite config cannot load.
 */
export const cardGlyphs =
  "楽天市場お買い物マラソン獲得予定実質還元率ポイントスプリントで計算point-sprint.bmth.dev0123456789,P%";
