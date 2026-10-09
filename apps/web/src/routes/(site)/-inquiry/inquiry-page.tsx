import { Heading, Text } from "@workspaces/ui";
import { PageWithSidebar } from "../-page-with-sidebar";
import { InquiryForm, type SendInquiry } from "./inquiry-form";

/** The inquiry page at `/inquiry`. */
export function InquiryPage({ send }: { send: SendInquiry }) {
  return (
    <PageWithSidebar maxW="640px">
      <Heading as="h1" fontSize="lg" mb="2">
        お問い合わせ
      </Heading>
      <Text fontSize="sm" color="fg.muted" mb="5">
        不具合のご報告やご要望をお送りください。返信先は入力いただいたメールアドレスです。
      </Text>
      <InquiryForm send={send} siteKey={import.meta.env.TURNSTILE_SITE_KEY ?? undefined} />
    </PageWithSidebar>
  );
}
