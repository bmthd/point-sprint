"use client";
import { Form, TextareaField, TextField } from "@/ui/form";
import { Button, VStack } from "@yamada-ui/react";
import { FC, useActionState } from "react";
import { inquiryForm$ } from "../../schema";
import { inquiryAction } from "./actions";

export const InquiryForm: FC = () => {
  const [state, dispatch, isPending] = useActionState(inquiryAction, {
    status: "idle",
  });

  return (
    <Form schema={inquiryForm$} action={dispatch} options={{ lastResult: state.submissionResult }}>
      {({ field }) => (
        <VStack>
          <TextField name={field.name.name} label="お名前" autoComplete="name" />
          <TextField name={field.email.name} label="メールアドレス" autoComplete="email" />
          <TextareaField name={field.message.name} label="お問い合わせ内容" />
          <Button type="submit" loading={isPending}>
            送信
          </Button>
        </VStack>
      )}
    </Form>
  );
};
