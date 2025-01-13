import { FC } from "react";
import { FormSection, SiteDescription } from "./components";
import { Container } from "@yamada-ui/react";

export const TopPage: FC = () => {
  return (
    <Container>
      <SiteDescription />
      <FormSection />
    </Container>
  );
};
