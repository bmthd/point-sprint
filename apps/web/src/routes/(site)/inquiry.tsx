import { createFileRoute } from "@tanstack/react-router";
import { InquiryPage } from "./-inquiry/inquiry-page.tsx";
import { pageHead } from "#/page-head.ts";

export const Route = createFileRoute("/(site)/inquiry")({
  head: () =>
    pageHead({
      path: "/inquiry",
      title: "お問い合わせ",
      description:
        "ポイントスプリントへの不具合のご報告やご要望は、このフォームからお送りください。",
    }),
  component: InquiryPage,
});
