import { H } from "@/ui/structure/h";
import { CircleHelpIcon } from "@yamada-ui/lucide";
import { Card, CardBody, CardHeader, Container, HStack, Tooltip } from "@yamada-ui/react";
import { FC } from "react";

export const SPUToggleGroup: FC = () => {
  return (
    <Card as={Container}>
      <CardHeader>
        <HStack>
          <Tooltip label="楽天市場に表示される倍率を入力してください">
            <CircleHelpIcon />
          </Tooltip>
          <H>SPU還元率を設定</H>
        </HStack>
      </CardHeader>
      <CardBody></CardBody>
    </Card>
  );
};
