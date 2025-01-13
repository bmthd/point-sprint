import { FieldName } from "@conform-to/react";
import { ReactNode } from "react";

/**
 * input要素に入力可能な値の型
 */
type Inputtable = string | string[] | number | boolean | (string | undefined)[] | undefined;

/**
 * フィールドのプロパティ
 */
export type FieldProps<T extends Inputtable = Inputtable> = {
  /** フィールド名 Conformの`field.fieldName.name`を使用する */
  name?: FieldName<T, Record<string, unknown>, string[]>;
  /** ヘルパーメッセージ */
  helperMessage?: string;
  /** ラベル */
  label?: ReactNode;
};
