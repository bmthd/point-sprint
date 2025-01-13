import { Layout } from "@/views/layout";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://point-sprint.bmth.dev/"),
  title: {
    template: "%s | ポイントスプリント",
    default: "ポイントスプリント 楽天市場お買い物マラソン攻略計算ツール",
  },
  description:
    "楽天市場のお買い物マラソンに特化した計算ツール。厳密な還元率、獲得上限に対応。あなたのポイ活を応援します。",
  openGraph: {
    type: "website",
    url: "https://point-sprint.bmth.dev/",
    siteName: "ポイントスプリント 楽天市場お買い物マラソン攻略計算ツール",
    title: "ポイントスプリント 楽天市場お買い物マラソン攻略計算ツール",
  },
  twitter: {
    card: "summary_large_image",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
