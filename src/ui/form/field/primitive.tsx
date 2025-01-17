"use client";

import { getInputProps, useField } from "@conform-to/react";
import {
  Checkbox,
  Input,
  Label,
  NumberInput,
  Switch,
  Textarea,
  VisuallyHidden,
} from "@yamada-ui/react";
import { type ComponentProps, type FC, JSX } from "react";
import { CustomFormControl } from "./form-control";
import { FieldProps } from "./types";
import { getFieldErrorProps } from "./utils";

/**
 * テキストフィールド
 * @param props - input要素のprops
 */
export const TextField: FC<FieldProps<string> & ComponentProps<typeof Input>> = ({
  name = "",
  label,
  ...props
}): JSX.Element => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <Input {...props} {...getInputProps(fieldMeta, { type: "text" })} />
    </CustomFormControl>
  );
};

export const NumberField: FC<FieldProps<number> & ComponentProps<typeof NumberInput>> = ({
  name,
  label,
  ...props
}): JSX.Element => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      {/* @ts-expect-error max type not match */}
      <NumberInput {...props} {...getInputProps(fieldMeta, { type: "number" })} />
    </CustomFormControl>
  );
};

export const TextareaField: FC<FieldProps<string> & ComponentProps<typeof Textarea>> = ({
  name,
  label,
  ...props
}): JSX.Element => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <Textarea {...props} {...getInputProps(fieldMeta, { type: "text" })} />
    </CustomFormControl>
  );
};

/**
 * チェックボックス
 * @param props - input要素のprops
 */
export const CheckboxField: FC<FieldProps<boolean> & ComponentProps<typeof Checkbox>> = ({
  name,
  label,
  ...props
}): JSX.Element => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <Checkbox {...props} {...getInputProps(fieldMeta, { type: "checkbox" })} />
    </CustomFormControl>
  );
};

export const CustomSwitchField: FC<FieldProps<boolean> & ComponentProps<typeof Switch>> = ({
  name,
  children,
  ...props
}): JSX.Element => {
  const [fieldMeta] = useField(name!);
  return (
    <Label>
      <VisuallyHidden>
        <Switch {...props} {...getInputProps(fieldMeta, { type: "checkbox" })} />
      </VisuallyHidden>
      {children}
    </Label>
  );
};
