import "@valibot/i18n/ja";
import * as v from "valibot";

v.setGlobalConfig({ lang: "ja" });
v.setSpecificMessage(v.nonOptional, "必須項目です", "ja");
v.setSpecificMessage(v.email, "メールアドレスを入力してください。", "ja");
