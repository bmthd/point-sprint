import { siteUrl } from "../../site-url.ts";

/**
 * Every letter the result's OGP image (`resultCard`) can draw. The fonts are cut down to these at
 * build time (`og-fonts-plugin.ts`), so a letter added to the card must be added here too; a test
 * checks it. Kept apart from the card, which the Vite config cannot load.
 */
export const cardGlyphs = `ポイントスプリントお買い物マラソン楽天ブランドデーの獲得還元率通常SPUキャンペーンを、上限まで計算するツール${new URL(siteUrl).host}0123456789,.P%`;
