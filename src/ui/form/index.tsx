"use client";
import { FormProvider, getFormProps, useForm } from "@conform-to/react";
import { getValibotConstraint, parseWithValibot } from "conform-to-valibot";
import { JSX, ReactNode, type ComponentProps } from "react";
import { type GenericSchema } from "valibot";

type UseFormReturn<
  TInput extends Record<string, unknown>,
  TOutput extends Record<string, unknown>,
> = ReturnType<typeof useForm<TInput, TOutput, string[]>>;

type FormMeta<TInput extends Record<string, unknown>, TOutput extends Record<string, unknown>> = {
  form: UseFormReturn<TInput, TOutput>[0];
  field: UseFormReturn<TInput, TOutput>[1];
};

/**
 * デフォルトの挙動を設定
 * @param schema バリデーションスキーマ
 * @param defaultValue デフォルト値
 */
const useCustomForm = <
  TInput extends Record<string, unknown>,
  TOutput extends Record<string, unknown>,
>(
  schema: GenericSchema<TInput, TOutput>,
  options: Parameters<typeof useForm<TInput, TOutput, string[]>>[0] = {},
): FormMeta<TInput, TOutput> => {
  const {
    shouldValidate = "onBlur",
    shouldRevalidate = "onInput",
    constraint = getValibotConstraint(schema),
    onValidate = ({ formData }) => parseWithValibot(formData, { schema }),
    ...rest
  } = options;
  const [form, field] = useForm<TInput, TOutput, string[]>({
    shouldValidate,
    shouldRevalidate,
    constraint,
    onValidate,
    ...rest,
  });
  return { form, field };
};

type FormProps<TInput extends Record<string, unknown>, TOutput extends Record<string, unknown>> = {
  schema?: GenericSchema<TInput>;
  options?: Parameters<typeof useForm<TInput>>[0];
  children?: ((props: FormMeta<TInput, TOutput>) => ReactNode) | ReactNode;
} & Omit<
  ComponentProps<"form">,
  keyof ReturnType<typeof getFormProps> | "children" | "defaultValue"
>;

/**
 * Conformの機能を統合したFormコンポーネント
 * schemaに渡されたバリデーションスキーマを元にフォームの入力欄meta情報をchildrenに渡す
 */
export const Form = <
  TInput extends Record<string, unknown>,
  TOutput extends Record<string, unknown>,
>({
  schema,
  options,
  children,
  ...props
}: FormProps<TInput, TOutput>): JSX.Element => {
  const { form, field } = useCustomForm(schema ?? ({} as any), options);

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
