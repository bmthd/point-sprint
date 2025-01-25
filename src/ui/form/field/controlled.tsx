"use client";
import { getSelectProps, useField, useInputControl } from "@conform-to/react";
import { Select, SelectProps } from "@yamada-ui/react";
import { useCallback, type FC } from "react";
import { CustomFormControl } from "./form-control";
import { type FieldProps } from "./types";
import { getFieldErrorProps } from "./utils";

interface SelectFieldProps extends FieldProps<string>, Omit<SelectProps, "name"> {}

export const SelectField: FC<SelectFieldProps> = ({ name, label, onChange, ...props }) => {
  const [fieldMeta] = useField(name!);
  const { value, change, blur, focus } = useInputControl(fieldMeta);
  const handleChange = useCallback(
    (value: string) => {
      change(value);
      onChange?.(value);
    },
    [change, onChange],
  );
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <Select
        value={value}
        onChange={handleChange}
        onBlur={blur}
        onFocus={focus}
        {...props}
        {...getSelectProps(fieldMeta)}
        key={fieldMeta.key}
      />
    </CustomFormControl>
  );
};
