"use client";
import { FormProvider, getFormProps, useForm, type DefaultValue } from "@conform-to/react";
import { getValibotConstraint, parseWithValibot } from "conform-to-valibot";
import { ReactNode, type ComponentProps } from "react";
import { type GenericSchema } from "valibot";

/**
 * デフォルトの挙動を設定
 * @param schema バリデーションスキーマ
 * @param defaultValue デフォルト値
 */
const useCustomForm = <T extends Record<string, unknown>>(
  schema: GenericSchema<T>,
  defaultValue?: DefaultValue<T>,
) => {
  const [form, field] = useForm<T, T, string[]>({
    defaultValue,
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    constraint: getValibotConstraint(schema),
    onValidate: ({ formData }) => parseWithValibot(formData, { schema }),
  });
  return { form, field } as const;
};

export type FormMeta<T extends Record<string, unknown>> = ReturnType<typeof useCustomForm<T>>;

/**
 * Conformの機能を統合したFormコンポーネント
 * schemaに渡されたバリデーションスキーマを元にフォームの入力欄meta情報をchildrenに渡す
 */
export const Form = <T extends Record<string, unknown>>({
  schema,
  defaultValue,
  children,
  ...props
}: {
  schema: GenericSchema<T>;
  defaultValue?: DefaultValue<T>;
  children: (props: ReturnType<typeof useCustomForm<T>>) => ReactNode;
} & Omit<
  ComponentProps<"form">,
  keyof ReturnType<typeof getFormProps> | "children" | "defaultValue"
>) => {
  const { form, field } = useCustomForm(schema, defaultValue);
  return (
    <FormProvider context={form.context}>
      <form {...props} {...getFormProps(form)}>
        {children({ form, field })}
      </form>
    </FormProvider>
  );
};

export * from "./field";
