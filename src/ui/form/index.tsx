"use client";
import { FormProvider, getFormProps, useForm } from "@conform-to/react";
import { getValibotConstraint, parseWithValibot } from "conform-to-valibot";
import NextForm from "next/form";
import { ReactNode, type ComponentProps } from "react";
import { object, type GenericSchema } from "valibot";

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

/**
 * Conformの機能を統合したFormコンポーネント
 * schemaに渡されたバリデーションスキーマを元にフォームの入力欄meta情報をchildrenに渡す
 */
export const Form = <T extends Record<string, unknown>>({
  schema = object({}) as unknown as GenericSchema<T>,
  options,
  children,
  ...props
}: {
  schema?: GenericSchema<T>;
  options?: Parameters<typeof useForm<T, T, string[]>>[0];
  children?: ((props: FormMeta<T>) => ReactNode) | ReactNode;
} & Omit<
  Partial<ComponentProps<typeof NextForm>>,
  keyof ReturnType<typeof getFormProps> | "children" | "defaultValue"
>) => {
  const { form, field } = useCustomForm(schema, options);
  return (
    <FormProvider context={form.context}>
      {/* @ts-expect-error actionをオプショナルにしたいため */}
      <NextForm {...props} {...getFormProps(form)}>
        {typeof children === "function" ? children({ form, field }) : children}
      </NextForm>
    </FormProvider>
  );
};

export * from "./field";
export type { FormState } from "./types";
