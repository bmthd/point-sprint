import { NumberField } from "@/ui/form";
import { H } from "@/ui/structure/h";
import { SPUEventInput } from "@/views/top-page/schema";
import { FieldMetadata } from "@conform-to/react";
import { CircleHelpIcon } from "@yamada-ui/lucide";
import {
  Card,
  CardBody,
  CardHeader,
  Container,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Tooltip,
} from "@yamada-ui/react";
import { FC } from "react";

const items: SegmentedControlItem[] = [
  { label: "スーパーセール", value: "7000" },
  { label: "お買い物マラソン", value: "5000" },
];

export const MaxPointForm: FC<{ field: FieldMetadata<SPUEventInput["maxPoint"]> }> = ({
  field,
}) => {
  return (
    <Container as={Card}>
      <CardHeader>
        <HStack>
          <Tooltip label="獲得上限が異なる場合に設定できます">
            <CircleHelpIcon />
          </Tooltip>
          <H>買い回り還元上限設定</H>
        </HStack>
      </CardHeader>
      <CardBody>
        <SegmentedControl items={items}></SegmentedControl>
        <NumberField name={field.name} label="買い回り還元上限" stepper={false} />
      </CardBody>
    </Container>
  );
};
