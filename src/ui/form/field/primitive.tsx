import { getInputProps, useField } from "@conform-to/react";
import { Checkbox, Input, NumberInput, Textarea } from "@yamada-ui/react";
import { type ComponentProps, type FC } from "react";
import { CustomFormControl } from "./form-control";
import { FieldProps } from "./types";

/**
 * テキストフィールド
 * @param props - input要素のprops
 */
export const TextField: FC<FieldProps<string> & ComponentProps<typeof Input>> = ({
  name,
  label,
  ...props
}) => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl label={label}>
      <Input {...props} {...(fieldMeta ?? getInputProps(fieldMeta, { type: "text" }))} />
    </CustomFormControl>
  );
};

export const NumberField: FC<FieldProps<number> & ComponentProps<typeof Input>> = ({
  name,
  label,
  ...props
}) => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl label={label}>
      <NumberInput {...props} {...(fieldMeta ?? getInputProps(fieldMeta, { type: "number" }))} />
    </CustomFormControl>
  );
};

export const TextareaField: FC<FieldProps<string> & ComponentProps<typeof Input>> = ({
  name,
  label,
  ...props
}) => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl label={label}>
      <Textarea {...props} {...(fieldMeta ?? getInputProps(fieldMeta, { type: "textarea" }))} />
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
