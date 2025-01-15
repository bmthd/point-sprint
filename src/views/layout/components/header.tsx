import { H } from "@/ui/structure/h";
import { Container } from "@yamada-ui/react";
import Link from "next/link";
import { FC } from "react";

export const Header: FC = () => (
  <Container as="header" bg="brand" p="md">
    <Link href="/">
      <H textColor="white" fontSize="3xl">
        ポイントスプリント！
      </H>
    </Link>
  </Container>
);
