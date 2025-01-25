import { HelpTooltip } from "@/ui/icon-button/help-tooltip";
import { H } from "@/ui/structure/h";
import { SPUEventInput } from "@/views/top-page/schema/calc";
import { FieldMetadata } from "@conform-to/react";
import { Card, CardBody, CardHeader, Container, HStack } from "@yamada-ui/react";
import { FC } from "react";
import { SegmentSelectField } from "./segment-select-field";

export const MaxPointForm: FC<{ field: FieldMetadata<SPUEventInput["maxPoint"]> }> = ({
  field,
}) => {
  return (
    <Container as={Card}>
      <CardHeader>
        <HStack>
          <HelpTooltip label="獲得上限が異なる場合に設定できます" />
          <H>買い回り還元上限設定</H>
        </HStack>
      </CardHeader>
      <CardBody>
        <SegmentSelectField field={field} />
      </CardBody>
    </Container>
  );
};
