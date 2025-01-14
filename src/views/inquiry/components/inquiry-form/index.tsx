"use client";
import { Form, TextareaField, TextField } from "@/ui/form";
import { NoticeEffect } from "@/ui/notice";
import { Button, VStack } from "@yamada-ui/react";
import { FC, useActionState } from "react";
import { schema } from "../../schema";
import { action } from "./actions";

export const InquiryForm: FC = () => {
  const [state, dispatch, isPending] = useActionState(action, { status: "idle" });

  return (
    <Form schema={schema} action={dispatch} lastResult={state.submissionResult}>
      {({ form, field }) => (
        <VStack>
          <TextField name={field.name.name} label="お名前" />
          <TextField name={field.email.name} label="メールアドレス" />
          <TextareaField name={field.message.name} label="お問い合わせ内容" />
          <Button type="submit" loading={isPending} colorScheme="primary">
            送信
          </Button>
          {state.status === "success" && (
            <NoticeEffect
              noticeOptions={{ status: "success", title: state.message }}
              onNoticeBefore={() => form.reset()}
            />
          )}
        </VStack>
      )}
    </Form>
  );
};
