import { type FieldMetadata } from "@conform-to/react";
import { type FormControlProps } from "@yamada-ui/react";

/**
 * フィールドのエラーに関する情報をConformのMetadataから取得する
 * @param metadata フィールドメタデータ
 */
export const getFieldErrorProps = <Schema>(
  metadata: FieldMetadata<Schema, Record<string, unknown>, string[]>,
) => {
  const { errors, required: isRequired } = metadata;
  const errorMessage = errors?.[0];
  return {
    errorMessage,
    isInvalid: Boolean(errors),
    isRequired,
  } as const satisfies FormControlProps;
};
