"use client";

import { getInputProps, useField } from "@conform-to/react";
import { Checkbox, Input, NumberInput, Textarea } from "@yamada-ui/react";
import { type ComponentProps, type FC } from "react";
import { CustomFormControl } from "./form-control";
import { FieldProps } from "./types";
import { getFieldErrorProps } from "./utils";

/**
 * テキストフィールド
 * @param props - input要素のprops
 */
export const TextField: FC<FieldProps<string> & ComponentProps<typeof Input>> = ({
  name,
  label,
  ...props
}) => {
  const [fieldMeta] = useField(name);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <Input {...props} {...getInputProps(fieldMeta, { type: "text" })} />
    </CustomFormControl>
  );
};

export const NumberField: FC<FieldProps<number> & ComponentProps<typeof Input>> = ({
  name,
  label,
  ...props
}) => {
  const [fieldMeta] = useField(name);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <NumberInput {...props} {...getInputProps(fieldMeta, { type: "number" })} />
    </CustomFormControl>
  );
};

export const TextareaField: FC<FieldProps<string> & ComponentProps<typeof Input>> = ({
  name,
  label,
  ...props
}) => {
  const [fieldMeta] = useField(name);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <Textarea {...props} {...getInputProps(fieldMeta, { type: "textarea" })} />
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
  const [fieldMeta] = useField(name);
  return <Checkbox {...props} {...getInputProps(fieldMeta, { type: "checkbox" })} />;
};
