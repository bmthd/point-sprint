import { Container } from "@yamada-ui/react";
import { FC } from "react";
import { FormSection, SiteDescription } from "./components";

export const TopPage: FC = () => {
  return (
    <Container>
      <SiteDescription />
      <FormSection />
    </Container>
  );
};
