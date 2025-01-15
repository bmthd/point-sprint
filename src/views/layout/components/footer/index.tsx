import { LinkItem } from "@/ui/link";
import { Box, Container, HStack, Link, Text } from "@yamada-ui/react";
import { FC } from "react";

const links: LinkItem[] = [
  { label: "トップ", href: "/" },
  { label: "お問い合わせ", href: "/inquiry" },
  { label: "利用規約", href: "/terms" },
];

export const Footer: FC = () => {
  return (
    <Container as="footer" bg="gray.100" placeItems="center">
      <HStack gap={8}>
        <Text textAlign="center">© 2023 bmth.dev All Rights Reserved.</Text>
        <Box
          // NOTE: 楽天ウェブサービスのクレジット表記は改変不可のため、HTMLコメントを埋め込む必要があり、dangerouslySetInnerHTMLを使用。
          dangerouslySetInnerHTML={{
            __html: /* html */ `<!-- Rakuten Web Services Attribution Snippet FROM HERE -->
            <a href="https://webservice.rakuten.co.jp/" target="_blank">
              <img src="https://webservice.rakuten.co.jp/img/credit/200709/credit_31130.gif" border="0" alt="Rakuten Web Service Center" title="Rakuten Web Service Center" width="311" height="30"/>
            </a>
            <!-- Rakuten Web Services Attribution Snippet TO HERE -->`,
          }}
        />
        <HStack>
          {links.map((link) => (
            <Link key={link.href} href={link.href} whiteSpace="nowrap">
              {link.label}
            </Link>
          ))}
        </HStack>
      </HStack>
    </Container>
  );
};
