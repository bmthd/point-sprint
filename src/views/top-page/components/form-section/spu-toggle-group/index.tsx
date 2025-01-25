import { H } from "@/ui/structure/h";
import { SPU_DEF, spuId } from "@/views/top-page/const/spu";
import { SPUEventInput } from "@/views/top-page/schema/storage";
import { FieldMetadata, FormMetadata } from "@conform-to/react";
import { CircleHelpIcon } from "@yamada-ui/lucide";
import {
  Card,
  CardBody,
  CardHeader,
  Container,
  For,
  Grid,
  HStack,
  Link,
  Text,
  Tooltip,
  VStack,
} from "@yamada-ui/react";
import { FC } from "react";
import * as v from "valibot";
import { SPUInformationButton } from "./spu-information-button";
import { SPURate } from "./spu-rate";
import { SPUToggle } from "./spu-toggle";

export const SPUToggleGroup: FC<{
  form: FormMetadata<SPUEventInput>;
  field: FieldMetadata<SPUEventInput["spu"]>;
}> = ({ field }) => {
  const fields = field.getFieldset();
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
      <CardBody>
        <HStack>
          <SPURate />
          <Link
            title="【楽天市場】SPU（スーパーポイントアッププログラム）｜ポイント最大16倍"
            href="https://hb.afl.rakuten.co.jp/hgc/14c23a4e.c4aad9d5.14c23a4f.15d8cec2/?pc=https%3A%2F%2Fevent.rakuten.co.jp%2Fcampaign%2Fpoint-up%2Feveryday%2Fpoint%2F&link_type=text&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9"
          >
            楽天であなたのSPU還元率を確認
          </Link>
        </HStack>
        <Grid templateColumns="repeat(5, minmax(0, 1fr))" gap="sm">
          <For each={spuId}>
            {(spuId) => {
              const name =
                "shortName" in SPU_DEF[spuId] && v.is(v.string(), SPU_DEF[spuId].shortName)
                  ? SPU_DEF[spuId].shortName
                  : SPU_DEF[spuId].name;
              return (
                <VStack key={spuId} gap="xs">
                  {/* @ts-ignore 型推論ができないため */}
                  <SPUToggle field={fields} spuId={spuId} />
                  <HStack gap="1">
                    <SPUInformationButton spuId={spuId} />
                    <Text fontSize="x-small">{name}</Text>
                  </HStack>
                </VStack>
              );
            }}
          </For>
        </Grid>
      </CardBody>
    </Card>
  );
};
