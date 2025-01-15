import { TextField } from "@/ui/form";
import { H } from "@/ui/structure/h";
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

export const MaxPointForm: FC = () => {
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
        <TextField label="買い回り還元上限" placeholder="0" />
      </CardBody>
    </Container>
  );
};
