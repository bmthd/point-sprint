"use client";
import { FormProvider, getFormProps, useForm } from "@conform-to/react";
import { getValibotConstraint, parseWithValibot } from "conform-to-valibot";
import NextForm from "next/form";
import { ReactNode, type ComponentProps } from "react";
import { object, type GenericSchema } from "valibot";

/**
 * デフォルトの挙動を設定
 * @param schema バリデーションスキーマ
 * @param defaultValue デフォルト値
 */
const useCustomForm = <T extends Record<string, unknown>>(
  schema: GenericSchema<T>,
  options: Parameters<typeof useForm<T, T, string[]>>[0] = {},
) => {
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
  return { form, field } as const;
};

export type FormMeta<T extends Record<string, unknown>> = ReturnType<typeof useCustomForm<T>>;

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
  children?: ((props: ReturnType<typeof useCustomForm<T>>) => ReactNode) | ReactNode;
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
