import { Card, Heading, Text } from "@workspaces/ui";
import { PageWithSidebar } from "../-page-with-sidebar";
import { InquiryForm, type SendInquiry } from "./inquiry-form";
import { ColumnHead } from "../../../ui/column-head";

/** The inquiry page at `/inquiry`. */
export function InquiryPage({ send }: { send: SendInquiry }) {
  return (
    <PageWithSidebar maxW="640px">
      <ColumnHead>
        <Heading as="h1" fontSize="lg">
          お問い合わせ
        </Heading>
      </ColumnHead>
      <Card.Root mt="2.5">
        <Card.Body display="block">
          <Text fontSize="sm" color="fg.muted" mb="5">
            不具合のご報告やご要望をお送りください。返信先は入力いただいたメールアドレスです。
          </Text>
          <InquiryForm send={send} siteKey={import.meta.env.TURNSTILE_SITE_KEY ?? undefined} />
        </Card.Body>
      </Card.Root>
    </PageWithSidebar>
  );
}
