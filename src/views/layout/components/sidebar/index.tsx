import { Button, Card, Container, Link } from "@yamada-ui/react";
import { ComponentProps, FC } from "react";
import { ShareButtonContainer } from "./share-button";

const RakutenLink = () => {
  const href =
    "https://hb.afl.rakuten.co.jp/hgc/14c23a4e.c4aad9d5.14c23a4f.15d8cec2/?pc=https%3A%2F%2Fwww.rakuten.co.jp%2F&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9";
  return (
    <Link href={href} external>
      <Button colorScheme="red" textColor="white">
        楽天市場にアクセス
      </Button>
    </Link>
  );
};

export const Sidebar: FC<ComponentProps<typeof Container>> = (props) => {
  return (
    <Container as={Card} bg="white" {...props}>
      <RakutenLink />
      <ShareButtonContainer />
    </Container>
  );
};
