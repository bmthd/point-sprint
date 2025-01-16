import { useInputControl, useField, getSelectProps } from "@conform-to/react";
import { Select } from "@yamada-ui/react";
import { type ComponentProps, type FC } from "react";
import { CustomFormControl } from "./form-control";
import { FieldProps } from "./types";
import { getFieldErrorProps } from "./utils";

export const SelectField: FC<FieldProps<string> & ComponentProps<typeof Select>> = ({
  name,
  label,
  ...props
}) => {
  const [fieldMeta] = useField(name!);
  const { value, change, blur, focus } = useInputControl<string>(name);
  return (
    <CustomFormControl label={label} {...getFieldErrorProps(fieldMeta)}>
      <Select
        value={value}
        onChange={change}
        onBlur={blur}
        onFocus={focus}
        {...props}
        {...getSelectProps(fieldMeta)}
      />
    </CustomFormControl>
  );
};
