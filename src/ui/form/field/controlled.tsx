"use client";
import { getSelectProps, useField, useInputControl } from "@conform-to/react";
import { HTMLProps, Select, SelectProps } from "@yamada-ui/react";
import { RefObject, useCallback, type FC } from "react";
import { CustomFormControl } from "./form-control";
import { type FieldProps } from "./types";
import { getFieldErrorProps } from "./utils";

interface SelectFieldProps
  extends FieldProps<string>,
    Omit<HTMLProps<"div">, "defaultValue" | "onChange">,
    Omit<SelectProps, "name"> {
  ref: RefObject<HTMLDivElement | null>;
}

export const SelectField: FC<SelectFieldProps> = ({ name = "", label, onChange, ...props }) => {
  const [fieldMeta] = useField(name);
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
        {...() => {
          const { defaultValue: _, ...props } = getSelectProps(fieldMeta, { value: false });
          return props;
        }}
        key={fieldMeta.key}
      />
    </CustomFormControl>
  );
};
