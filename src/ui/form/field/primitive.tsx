import { getInputProps, useField } from "@conform-to/react";
import { Checkbox, Input } from "@yamada-ui/react";
import { type ComponentProps, type FC } from "react";
import { CustomFormControl } from "./form-control";
import { FieldProps } from "./types";

/**
 * テキストフィールド
 * @param props - input要素のprops
 */
export const TextField: FC<FieldProps<string> & ComponentProps<typeof Input>> = ({
  name,
  ...props
}) => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl>
      <Input {...props} {...(fieldMeta ?? getInputProps(fieldMeta, { type: "text" }))} />
    </CustomFormControl>
  );
};

/**
 * チェックボックス
 * @param props - input要素のprops
 */
export const CheckboxField: FC<FieldProps<string> & ComponentProps<typeof Checkbox>> = ({
  name,
  ...props
}) => {
  const [fieldMeta] = useField(name!);
  return <Checkbox {...props} {...getInputProps(fieldMeta, { type: "checkbox" })} />;
};
