import "@valibot/i18n/ja";
import { Container, HStack } from "@yamada-ui/react";
import { FC, ReactNode } from "react";
import * as v from "valibot";
import { Footer, Header, Providers } from "./components";
import { Sidebar } from "./components/sidebar";

v.setGlobalConfig({ lang: "ja" });

export const Layout: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <Providers>
      <Container p={0} bg="blackAlpha.100" minH="100vh" overflow="hidden">
        <Header />
        <HStack as="main" alignItems="flex-start" px={4} h="full">
          {children}
          <Sidebar w="lg" />
        </HStack>
        <Footer />
      </Container>
    </Providers>
  );
};
