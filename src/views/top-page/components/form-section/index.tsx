"use client";
import { Form } from "@/ui/form";
import { VStack } from "@yamada-ui/react";
import { FC } from "react";
import { SPUEvent, spuEventSchema } from "../../schema";
import { CalcTable } from "./calc-table";
import { MaxPointForm } from "./max-point-form";
import { SPUToggleGroup } from "./spu-toggle-group";
import { initializeItem } from "../../schema";

export const FormSection: FC = () => {
  const defaultValue: SPUEvent = {
    items: Array.from({ length: 10 }).map(() => initializeItem()),
    maxPoint: 7000,
    spuButtons: {},
  };
  return (
    <Form schema={spuEventSchema} options={{ defaultValue }}>
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
