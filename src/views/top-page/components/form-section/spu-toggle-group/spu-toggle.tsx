import { CustomSwitchField } from "@/ui/form";
import { SPU_DEF, SpuID } from "@/views/top-page/const/spu";
import { SPUEventInput } from "@/views/top-page/schema/storage";
import { useIsSPULimitExceeded } from "@/views/top-page/store";
import { FieldMetadata, useFormMetadata } from "@conform-to/react";
import { Grid, Text, ui } from "@yamada-ui/react";
import Image from "next/image";
import { ComponentProps, JSX, useCallback, useMemo } from "react";
import * as R from "remeda";
import { useSaveFormDataRef } from "../save";
import { hasRelatedUpdate, hasUpdates, relatedUpdateMap } from "./related-update";

export const SPUToggle = <T extends SpuID>({
  field,
  spuId,
}: { field: FieldMetadata<SPUEventInput["spu"]>; spuId: T }): JSX.Element => {
  const form = useFormMetadata<SPUEventInput>();
  const spu = SPU_DEF[spuId];
  // @ts-ignore 型推論ができないため
  const isChecked = Boolean(field[spuId].value);
  const isLimitExceeded = useIsSPULimitExceeded(spuId);
  const ref = useSaveFormDataRef();

  const update = useCallback(() => {
    if (!hasRelatedUpdate(spuId)) return;
    const related = relatedUpdateMap[spuId];
    const bool = `${isChecked}` as const;
    if (!hasUpdates(related, bool)) return;
    const updates = related[bool];
    R.keys(updates).forEach((key) => {
      // @ts-ignore 型推論ができないため
      form.update({ name: field[key].name, value: updates[key] });
    });
  }, []);

  const styles = useMemo<ComponentProps<typeof ui.button>>(() => {
    if (!isChecked) return { bg: "gray.100", _hover: { bg: "gray.200" } };
    if (isLimitExceeded)
      return { bg: "brandSecondary", textColor: "white", _hover: { bg: "brandSecondary.600" } };
    return { bg: "brand", textColor: "white", _hover: { bg: "brand.600" } };
  }, [isChecked, isLimitExceeded]);
  return (
    // @ts-ignore 型推論ができないため
    <CustomSwitchField ref={ref} name={field[spuId].name} onChange={update}>
      <ui.div
        type="button"
        display="flex"
        flexDir="column"
        placeItems="center"
        gap="xs"
        rounded="lg"
        {...styles}
        p={2}
        w={16}
        h={16}
        transitionDuration="0.2s"
        transitionProperty="colors"
      >
        <Grid placeItems="center" rounded="md" bg="white" p="1px">
          <Image src={spu.image} alt={spu.name} width={28} height={28} />
        </Grid>
        <Text fontSize="xs">{spu.rate}%</Text>
      </ui.div>
    </CustomSwitchField>
  );
};
