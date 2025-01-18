"use client";
import { getSelectProps, useField, useInputControl } from "@conform-to/react";
import { Select } from "@yamada-ui/react";
import { type ComponentProps, type FC } from "react";
import { CustomFormControl } from "./form-control";
import { type FieldProps } from "./types";
import { getFieldErrorProps } from "./utils";

export const SelectField: FC<FieldProps<string> & ComponentProps<typeof Select>> = ({
  name,
  label,
  ...props
}) => {
  const [fieldMeta] = useField(name!);
  const { value, change, blur, focus } = useInputControl<string>(fieldMeta);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <Select
        value={value}
        onChange={change}
        onBlur={blur}
        onFocus={focus}
        {...props}
        {...getSelectProps(fieldMeta)}
        key={fieldMeta.key}
      />
    </CustomFormControl>
  );
};

export const NumberSelectField: FC<FieldProps<number> & ComponentProps<typeof Select>> = ({
  name,
  label,
  ...props
}) => {
  const [fieldMeta] = useField(name!);
  const { value, change, blur, focus } = useInputControl<number>(fieldMeta);
  // const ref = useRef(null);
  // const handleFocus = useCallback(() => {
  //   ref.current?.focus();
  // }, []);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      {/* <input
        name={name}
        defaultValue={fieldMeta.initialValue}
        tabIndex={-1}
        onFocus={handleFocus}
        /> */}
      <Select
        // ref={ref}
        value={value}
        onChange={change}
        onBlur={blur}
        onFocus={focus}
        {...props}
        {...getSelectProps(fieldMeta, { value: false })}
        key={fieldMeta.key}
      />
    </CustomFormControl>
  );
};
