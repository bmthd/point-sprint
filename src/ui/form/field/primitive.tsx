"use client";

import { getInputProps, getTextareaProps, useField } from "@conform-to/react";
import {
  Checkbox,
  Component,
  Input,
  InputProps,
  Label,
  NumberInput,
  NumberInputProps,
  SwitchProps,
  Textarea,
  TextareaProps,
  VisuallyHidden,
} from "@yamada-ui/react";
import { ComponentProps, type FC, ReactNode } from "react";
import { CustomFormControl } from "./form-control";
import { FieldProps } from "./types";
import { getFieldErrorProps } from "./utils";

interface TextFieldProps extends FieldProps<string>, Omit<InputProps, "name"> {}

/**
 * テキストフィールド
 * @param props - input要素のprops
 */
export const TextField: FC<TextFieldProps> = ({ name = "", label, ...props }) => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <Input {...props} {...getInputProps(fieldMeta, { type: "text" })} key={fieldMeta.key} />
    </CustomFormControl>
  );
};

interface NumberFieldProps
  extends FieldProps<number>,
    Omit<NumberInputProps, "name">,
    Omit<ComponentProps<"input">, keyof NumberInputProps> {}

export const NumberField: FC<NumberFieldProps> = ({ name, label, helperMessage, ...props }) => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl {...{ label, helperMessage }} {...getFieldErrorProps(fieldMeta)}>
      {/* @ts-expect-error max type not match */}
      <NumberInput
        {...props}
        {...getInputProps(fieldMeta, { type: "number" })}
        key={fieldMeta.key}
      />
    </CustomFormControl>
  );
};

interface TextareaFieldProps extends FieldProps<string>, Component<"textarea", TextareaProps> {}

export const TextareaField: FC<TextareaFieldProps> = ({ name, label, ...props }) => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <Textarea {...props} {...getTextareaProps(fieldMeta)} key={fieldMeta.key} resize="vertical" />
    </CustomFormControl>
  );
};

interface CheckboxFieldProps extends FieldProps<boolean>, Component<"input", InputProps> {}

/**
 * チェックボックス
 * @param props - input要素のprops
 */
export const CheckboxField: FC<CheckboxFieldProps> = ({ name, label, ...props }) => {
  const [fieldMeta] = useField(name!);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <Checkbox
        {...props}
        {...getInputProps(fieldMeta, { type: "checkbox" })}
        key={fieldMeta.key}
      />
    </CustomFormControl>
  );
};

interface SwitchFieldProps
  extends FieldProps<boolean>,
    Omit<Component<"input", SwitchProps>, "children" | "contextTypes" | "defaultProps"> {
  children: ReactNode;
}

export const CustomSwitchField: FC<SwitchFieldProps> = ({ name, children, ...props }) => {
  const [fieldMeta] = useField(name!);
  return (
    <Label>
      <VisuallyHidden
        as="input"
        {...props}
        {...getInputProps(fieldMeta, { type: "checkbox" })}
        key={fieldMeta.key}
      />
      {children}
    </Label>
  );
};

interface HiddenFieldProps extends FieldProps<string | number | boolean> {}

/**
 * 隠しフィールド
 */
export const HiddenField: FC<HiddenFieldProps> = ({ name, ...props }) => {
  const [fieldMeta] = useField(name!);
  return (
    <VisuallyHidden
      as="input"
      {...getInputProps(fieldMeta, { type: "hidden" })}
      {...props}
      key={fieldMeta.key}
    />
  );
};
