"use client";
import { FormProvider, getFormProps, useForm } from "@conform-to/react";
import { getValibotConstraint, parseWithValibot } from "conform-to-valibot";
import { JSX, ReactNode, type ComponentProps } from "react";
import { type GenericSchema } from "valibot";

type UseFormReturn<T extends Record<string, unknown>> = ReturnType<typeof useForm<T, T, string[]>>;

export type FormMeta<T extends Record<string, unknown>> = {
  form: UseFormReturn<T>[0];
  field: UseFormReturn<T>[1];
};

/**
 * デフォルトの挙動を設定
 * @param schema バリデーションスキーマ
 * @param defaultValue デフォルト値
 */
const useCustomForm = <T extends Record<string, unknown>>(
  schema: GenericSchema<T>,
  options: Parameters<typeof useForm<T, T, string[]>>[0] = {},
): FormMeta<T> => {
  const {
    shouldValidate = "onBlur",
    shouldRevalidate = "onInput",
    constraint = getValibotConstraint(schema),
    onValidate = ({ formData }) => parseWithValibot(formData, { schema }),
    ...rest
  } = options;
  const [form, field] = useForm<T, T, string[]>({
    shouldValidate,
    shouldRevalidate,
    constraint,
    onValidate,
    ...rest,
  });
  return { form, field };
};

type FormProps<T extends Record<string, unknown>> = {
  schema?: GenericSchema<T>;
  options?: Parameters<typeof useForm<T>>[0];
  children?: ((props: FormMeta<T>) => ReactNode) | ReactNode;
} & Omit<ComponentProps<'form'>, keyof ReturnType<typeof getFormProps> | "children" | "defaultValue">;

/**
 * Conformの機能を統合したFormコンポーネント
 * schemaに渡されたバリデーションスキーマを元にフォームの入力欄meta情報をchildrenに渡す
 */
export const Form = <T extends Record<string, unknown>>({
  schema,
  options,
  children,
  ...props
}: FormProps<T>): JSX.Element => {
  const { form, field } = useCustomForm(schema ?? ({} as GenericSchema<T>), options);

  return (
    <FormProvider context={form.context}>
      <form {...props} {...getFormProps(form)}>
        {typeof children === "function" ? children({ form, field }) : children}
      </form>
    </FormProvider>
  );
};

export * from "./field";
export type { FormState } from "./types";
