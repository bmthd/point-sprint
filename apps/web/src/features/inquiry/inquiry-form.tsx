import { Field as FormField, useForm } from "@formisch/react";
import { Alert, Button, Checkbox, Field, Input, Text, Textarea, VStack } from "@workspaces/ui";
import { type ComponentType, useState } from "react";
import * as v from "valibot";
import { Form, bind, errorsOf } from "../../form/form";
import type { InquiryResult } from "../../server/inquiry";
import {
  INQUIRY_TURNSTILE_ACTION,
  InquiryInputSchema,
  type InquiryRequest,
} from "../../server/inquiry-input";
import { TurnstileWidget, type TurnstileWidgetProps } from "./turnstile-widget";

export type SendInquiry = (request: InquiryRequest) => Promise<InquiryResult>;

/**
 * Only this answer means the mail went out. The server can answer something else, such as an
 * error body that the server function's client gives back as it is.
 */
const SentSchema = v.object({ ok: v.literal(true) });

const emptyInput = { name: "", email: "", wantsReply: false, body: "" };

type Props = {
  send: SendInquiry;
  /** Turnstile's site key, or `undefined` when the build had none: nothing can be sent then. */
  siteKey: string | undefined;
  /** The Turnstile widget; tests give one that does not load Cloudflare's script. */
  widget?: ComponentType<TurnstileWidgetProps>;
};

/**
 * Name (optional), the address to reply to and the message, sent once Turnstile's check has
 * passed. A failed send keeps what was written, to be sent again.
 */
export function InquiryForm({ send, siteKey, widget: Widget = TurnstileWidget }: Props) {
  const form = useForm({ schema: InquiryInputSchema, initialInput: emptyInput });
  const [token, setToken] = useState<string | undefined>(undefined);
  const [resetKey, setResetKey] = useState(0);
  const [status, setStatus] = useState<"editing" | "sent" | "failed">("editing");

  if (status === "sent") {
    return (
      <Alert.Root status="success" role="status">
        <Alert.Icon />
        <Alert.Description>
          お問い合わせを送信しました。内容を確認し、必要に応じて入力いただいたメールアドレスにご返信します。
        </Alert.Description>
      </Alert.Root>
    );
  }

  const submit = async (input: typeof emptyInput) => {
    if (token === undefined) return;
    const sent = await send({ ...input, turnstileToken: token }).then(
      (result: unknown) => v.is(SentSchema, result),
      () => false,
    );
    if (sent) {
      setStatus("sent");
      return;
    }
    setStatus("failed");
    // The token has been used: the next try needs a new one.
    setToken(undefined);
    setResetKey((key) => key + 1);
  };

  return (
    <Form of={form} onSubmit={submit} aria-label="お問い合わせ">
      <VStack gap="4" alignItems="stretch">
        <FormField of={form} path={["name"]}>
          {(field) => (
            <Field.Root label="お名前（任意）" {...errorsOf(field)}>
              <Input autoComplete="name" {...bind(field)} />
            </Field.Root>
          )}
        </FormField>
        <FormField of={form} path={["email"]}>
          {(field) => (
            <Field.Root label="返信先のメールアドレス" required {...errorsOf(field)}>
              <Input type="email" inputMode="email" autoComplete="email" {...bind(field)} />
            </Field.Root>
          )}
        </FormField>
        <FormField of={form} path={["wantsReply"]}>
          {(field) => (
            <Checkbox {...field.props} checked={field.input === true} colorScheme="primary">
              返信を希望する
            </Checkbox>
          )}
        </FormField>
        <FormField of={form} path={["body"]}>
          {(field) => (
            <Field.Root label="お問い合わせの内容" required {...errorsOf(field)}>
              <Textarea rows={8} {...bind(field)} />
            </Field.Root>
          )}
        </FormField>
        {siteKey === undefined ? (
          <Text role="alert" fontSize="sm" color="danger.fg">
            いまはお問い合わせを受け付けられません。時間をおいてお試しください。
          </Text>
        ) : (
          <Widget
            siteKey={siteKey}
            action={INQUIRY_TURNSTILE_ACTION}
            onToken={setToken}
            resetKey={resetKey}
          />
        )}
        {status === "failed" ? (
          <Alert.Root status="error" role="alert">
            <Alert.Icon />
            <Alert.Description>
              送信できませんでした。時間をおいて、もう一度お試しください。
            </Alert.Description>
          </Alert.Root>
        ) : null}
        <Button
          type="submit"
          colorScheme="primary"
          alignSelf="flex-start"
          disabled={token === undefined}
          loading={form.isSubmitting}
          loadingMessage="送信しています"
        >
          送信する
        </Button>
      </VStack>
    </Form>
  );
}
