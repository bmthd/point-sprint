import { createFileRoute } from "@tanstack/react-router";
import { InquiryPage } from "./-inquiry/inquiry-page";
import { pageHead } from "../../page-head";

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
