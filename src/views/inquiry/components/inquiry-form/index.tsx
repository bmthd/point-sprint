"use client";
import { Form, TextareaField, TextField } from "@/ui/form";
import { NoticeEffect } from "@/ui/notice";
import { Button, VStack } from "@yamada-ui/react";
import { FC, useActionState } from "react";
import { schema } from "../../schema";
import { inquiryAction } from "./actions";

export const InquiryForm: FC = () => {
  const [state, dispatch, isPending] = useActionState(inquiryAction, {
    status: "idle",
    submissionResult: { initialValue: { name: "", email: "", message: "" } },
  });

  return (
    <Form
      schema={schema}
      action={dispatch}
      lastResult={state.submissionResult}
      defaultValue={{ name: "", email: "", message: "" }}
    >
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
