import { FieldMetadata } from "@conform-to/react";

export const isArrayOfString = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * フィールドのエラーに関する情報をConformのMetadataから取得する
 * @param metadata フィールドメタデータ
 */
export const getFieldErrorProps = <Schema>(
  metadata: FieldMetadata<Schema, Record<string, unknown>, unknown>,
) => {
  const { errors, required: isRequired } = metadata;
  const errorMessage = isArrayOfString(errors) ? errors[0] : undefined;
  return {
    errorMessage,
    isInvalid: Boolean(errors),
    isRequired,
  } as const;
};
