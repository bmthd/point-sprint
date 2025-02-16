"use client";
import { Form, TextareaField, TextField } from "@/ui/form";
import { HStack, VStack } from "@yamada-ui/react";
import { FC, useActionState } from "react";
import { inquiryForm$ } from "../../schema";
import { inquiryAction } from "./actions";
import { SubmitButton } from "./submit-button";

export const InquiryForm: FC = () => {
  const [state, dispatch] = useActionState(inquiryAction, {
    status: "idle",
  });

  return (
    <Form schema={inquiryForm$} action={dispatch} options={{ lastResult: state.submissionResult }}>
      {({ field }) => (
        <VStack>
          <TextField name={field.name.name} label="お名前" autoComplete="name" />
          <TextField name={field.email.name} label="メールアドレス" autoComplete="email" />
          <TextareaField name={field.message.name} label="お問い合わせ内容" />
          <HStack alignSelf="end">
            <SubmitButton />
          </HStack>
        </VStack>
      )}
    </Form>
  );
};
