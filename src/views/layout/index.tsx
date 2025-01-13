import { Container, HStack } from "@yamada-ui/react";
import { FC, ReactNode } from "react";
import { Header, Providers } from "./components";
import { Sidebar } from "./components/sidebar";

export const Layout: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <Providers>
      <Container p={0} bg="blackAlpha.100" h="full">
        <Header />
        <HStack alignItems="flex-start" justifyItems="">
          {children}
          <Sidebar w="lg" />
        </HStack>
      </Container>
    </Providers>
  );
};
