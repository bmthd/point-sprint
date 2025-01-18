"use client";
import { Form } from "@/ui/form";
import { VStack } from "@yamada-ui/react";
import { FC } from "react";
import { initializeSPUEventForm, spuEventSchema } from "../../schema";
import { CalcTable } from "./calc-table";
import { MaxPointForm } from "./max-point-form";
import { SPUToggleGroup } from "./spu-toggle-group";

export const FormSection: FC = () => {
  const defaultValue = initializeSPUEventForm();
  return (
    <Form schema={spuEventSchema} options={{ defaultValue }}>
      {({ form, field }) => (
        <VStack>
          <SPUToggleGroup field={field.spu} />
          <MaxPointForm field={field.maxPoint} />
          <CalcTable {...{ form }} field={field.items} />
        </VStack>
      )}
    </Form>
  );
};
