"use client";
import { Form } from "@/ui/form";
import { VStack } from "@yamada-ui/react";
import { FC } from "react";
import { schema } from "../../schema";
import { CalcTable } from "./calc-table";
import { MaxPointForm } from "./max-point-form";
import { SPUToggleGroup } from "./spu-toggle-group";

export const FormSection: FC = () => {
  return (
    <Form schema={schema}>
      {({ form, field }) => (
        <VStack>
          <SPUToggleGroup />
          <MaxPointForm />
          <CalcTable {...{ form }} field={field.items} />
        </VStack>
      )}
    </Form>
  );
};
