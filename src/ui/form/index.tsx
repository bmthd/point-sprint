"use client";
import {
  FormProvider,
  getFormProps,
  SubmissionResult,
  useForm,
  type DefaultValue,
} from "@conform-to/react";
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
  defaultValue?: DefaultValue<T>,
  lastResult?: SubmissionResult<string[]>,
) => {
  const [form, field] = useForm<T, T, string[]>({
    defaultValue,
    lastResult,
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    constraint: getValibotConstraint(schema),
    onValidate: ({ formData }) => parseWithValibot(formData, { schema }),
    onSubmit: async () => {},
  });
  return { form, field } as const;
};

/**
 * Conformの機能を統合したFormコンポーネント
 * schemaに渡されたバリデーションスキーマを元にフォームの入力欄meta情報をchildrenに渡す
 */
export const Form = <T extends Record<string, unknown>>({
  schema = object({}) as unknown as GenericSchema<T>,
  defaultValue,
  lastResult,
  children,
  ...props
}: {
  schema?: GenericSchema<T>;
  defaultValue?: DefaultValue<T>;
  lastResult?: SubmissionResult<string[]>;
  children?: ((props: ReturnType<typeof useCustomForm<T>>) => ReactNode) | ReactNode;
} & Omit<
  Partial<ComponentProps<typeof NextForm>>,
  keyof ReturnType<typeof getFormProps> | "children" | "defaultValue"
>) => {
  const { form, field } = useCustomForm(schema, defaultValue, lastResult);
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
