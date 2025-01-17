import { CountDisplay } from "@/ui/count-display";
import { H } from "@/ui/structure/h";
import { CircleHelpIcon } from "@yamada-ui/lucide";
import {
  Card,
  CardBody,
  CardHeader,
  Container,
  Grid,
  HStack,
  Link,
  Tooltip,
} from "@yamada-ui/react";
import { FC } from "react";

export const SPUToggleGroup: FC = () => {
  return (
    <Card as={Container}>
      <CardHeader>
        <HStack>
          {/* @ts-expect-error 式は、複雑すぎて */}
          <Tooltip label="楽天市場に表示される倍率を入力してください">
            <CircleHelpIcon />
          </Tooltip>
          <H>SPU還元率を設定</H>
        </HStack>
      </CardHeader>
      <CardBody>
        <HStack>
          <CountDisplay count={0} unit="倍" />
          <Link
            title="【楽天市場】SPU（スーパーポイントアッププログラム）｜ポイント最大16倍"
            href="https://hb.afl.rakuten.co.jp/hgc/14c23a4e.c4aad9d5.14c23a4f.15d8cec2/?pc=https%3A%2F%2Fevent.rakuten.co.jp%2Fcampaign%2Fpoint-up%2Feveryday%2Fpoint%2F&link_type=text&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9"
          >
            楽天であなたのSPU還元率を確認
          </Link>
        </HStack>
        <Grid templateColumns="repeat(2, 1fr)" gap={4}></Grid>
      </CardBody>
    </Card>
  );
};
