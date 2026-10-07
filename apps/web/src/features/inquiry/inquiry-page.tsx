import { Box, Heading, Text } from "@workspaces/ui";
import { InquiryForm, type SendInquiry } from "./inquiry-form";

/** The inquiry page at `/inquiry`. */
export function InquiryPage({ send }: { send: SendInquiry }) {
  return (
    <Box as="main" maxW="640px" mx="auto" px="4" pt="4" pb="16">
      <Heading as="h1" fontSize="lg" mb="2">
        お問い合わせ
      </Heading>
      <Text fontSize="sm" color="fg.muted" mb="5">
        不具合のご報告やご要望をお送りください。返信先は入力いただいたメールアドレスです。
      </Text>
      <InquiryForm send={send} siteKey={import.meta.env.TURNSTILE_SITE_KEY ?? undefined} />
    </Box>
  );
}
