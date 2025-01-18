import * as v from "valibot";
import { createEnv } from "valibot-env/nextjs";

/**
 * 数値っぽい文字列を数値に変換するスキーマ
 */
const numberish = v.pipe(v.string(), v.transform(parseInt));

/**
 * 検証済み環境変数
 * @see https://zenn.dev/chot/articles/abount-valibot-env
 */
export const env = createEnv({
  schema: {
    public: {
      NEXT_PUBLIC_APP_VERSION: numberish,
    },
    private: {
      TRACKING_ID: v.pipe(v.string(), v.startsWith("G-"), v.length(12)),
      URL: v.string(),
      GMAIL_ADDRESS: v.pipe(v.string(), v.email()),
      GMAIL_PASSWORD: v.string(),
      RAKUTEN_APPLICATION_ID: v.string(),
      RAKUTEN_AFFILIATE_ID: v.string(),
    },
  },
  values: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    TRACKING_ID: process.env.TRACKING_ID,
    URL: process.env.URL,
    GMAIL_ADDRESS: process.env.GMAIL_ADDRESS,
    GMAIL_PASSWORD: process.env.GMAIL_PASSWORD,
    RAKUTEN_APPLICATION_ID: process.env.RAKUTEN_APPLICATION_ID,
    RAKUTEN_AFFILIATE_ID: process.env.RAKUTEN_AFFILIATE_ID,
  },
});
