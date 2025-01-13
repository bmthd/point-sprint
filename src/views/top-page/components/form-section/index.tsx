"use client";
import { Form } from "@/ui/form";
import { FC } from "react";
import { VStack } from "@yamada-ui/react";
import { schema } from "../../schema";
import { CalcTable } from "./calc-table";
import { MaxPointForm } from "./max-point-form";
import { SPUToggleGroup } from "./spu-toggle-group";

export const FormSection: FC = () => {
  return (
    <Form schema={schema}>
      {() => (
        <VStack>
          <SPUToggleGroup />
          <MaxPointForm />
          <CalcTable />
        </VStack>
      )}
    </Form>
  );
};
