import "server-only";
import "@valibot/i18n/ja";
import * as v from "valibot";

v.setGlobalConfig({ lang: "ja" });
v.setSchemaMessage("スキーマの検証に失敗しました。");

const envSchema = v.object({
  TRACKING_ID: v.pipe(v.string(), v.startsWith("G-"), v.length(12)),
  URL: v.string(),
  GMAIL_ADDRESS: v.pipe(v.string(), v.email()),
  GMAIL_PASSWORD: v.string(),
  RAKUTEN_APPLICATION_ID: v.string(),
  RAKUTEN_AFFILIATE_ID: v.string(),
});

/**
 * Type Safeな環境変数を取得する
 */
export const env = v.parse(envSchema, process.env);
