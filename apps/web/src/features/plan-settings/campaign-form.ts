import * as v from "valibot";
import {
  END_BEFORE_START,
  dateSchema,
  optionalPointsSchema,
  rateSchema,
  textSchema,
  yenSchema,
} from "../../form/field-schemas";

/** Which fields a template's form asks for, and the hint on its button. */
export type FormSpec = {
  hint: string;
  /** One date and a +1 / +2 choice (a team that won, or both). */
  date?: boolean;
  period?: boolean;
  rate?: boolean;
  cap?: "optional" | "required";
  minOrderAmount?: boolean;
  label?: boolean;
};

export const SPECS: Record<string, FormSpec> = {
  "sports-win": { hint: "勝った翌日と倍率", date: true },
  "39shop": { hint: "開催期間", period: true },
  repeat: { hint: "期間・条件金額・上限", period: true, minOrderAmount: true, cap: "required" },
  "shop-around-manual": { hint: "プリセットのない回", period: true, cap: "required" },
  "custom-rate": {
    hint: "倍率・上限・期間を自分で",
    label: true,
    period: true,
    rate: true,
    cap: "optional",
  },
};

/**
 * The form of a template. Every field is there; those the template does not ask for keep their
 * defaults, which are valid.
 */
export const campaignFormSchema = (spec: FormSpec) =>
  v.pipe(
    v.object({
      label: textSchema("名前", 50),
      date: dateSchema("日付"),
      start: dateSchema("開始日"),
      end: dateSchema("終了日"),
      rate: rateSchema("倍率"),
      minOrderAmount: yenSchema("条件金額"),
      cap: v.pipe(
        optionalPointsSchema("獲得上限"),
        v.check((cap) => spec.cap !== "required" || cap !== undefined, "獲得上限を入れてください"),
      ),
    }),
    v.forward(
      v.partialCheck([["start"], ["end"]], ({ start, end }) => start <= end, END_BEFORE_START),
      ["end"],
    ),
  );

export type CampaignFormSchema = ReturnType<typeof campaignFormSchema>;
