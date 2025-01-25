"use client";
import { Form, HiddenField } from "@/ui/form";
import { VStack } from "@yamada-ui/react";
import dynamic from "next/dynamic";
import { FC } from "react";
import { initializeSPUEventForm, spuEventStorageSchema } from "../../schema/storage";
import { CalcTable } from "./calc-table";
import { MaxPointForm } from "./max-point-form";
import { SPUToggleGroup } from "./spu-toggle-group";

const DebugComponent = dynamic(() => import("@/ui/form/debug"));

export const FormSection: FC = () => {
  const defaultValue = initializeSPUEventForm();
  return (
    <Form schema={spuEventStorageSchema} options={{ defaultValue }}>
      {({ form, field }) => (
        <VStack>
          <SPUToggleGroup form={form} field={field.spu} />
          <MaxPointForm field={field.maxPoint} />
          <CalcTable {...{ form }} field={field.items} />
          <HiddenField name={field.taxRate.name} />
          <HiddenField name={field.createdAt.name} />
          <HiddenField name={field.updatedAt.name} />
          <DebugComponent />
        </VStack>
      )}
    </Form>
  );
};
