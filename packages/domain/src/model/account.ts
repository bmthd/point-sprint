import * as v from "valibot";
import { IdSchema } from "./common";

/**
 * A Rakuten account the user buys with, so that caps shared across plans are counted per account.
 * It holds no credentials, only a name the user tells it apart by.
 */
export const AccountSchema = v.object({
  id: IdSchema,
  name: v.pipe(v.string(), v.nonEmpty()),
});
export type Account = v.InferOutput<typeof AccountSchema>;

/** The account of every plan that names none, which is every plan saved before accounts existed. */
export const DEFAULT_ACCOUNT_ID = "acc00000-0000-4000-8000-000000000000";

export const defaultAccount = (): Account => ({ id: DEFAULT_ACCOUNT_ID, name: "メイン" });
