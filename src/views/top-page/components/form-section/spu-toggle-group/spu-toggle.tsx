import { CustomSwitchField } from "@/ui/form";
import { FieldMetadata } from "@conform-to/react";
import { Box } from "@yamada-ui/react";
import Image from "next/image";
import { FC } from "react";

export const SPUToggle: FC<{ field: FieldMetadata<boolean> }> = ({ field }) => {
  const isChecked = field.value;
  return (
    // <Box>

    // </Box>
    <CustomSwitchField field={field}>
      <Box>
        <Box rounded="lg" bg="white">
          <Image src="" alt="" />
        </Box>
      </Box>
    </CustomSwitchField>
  );
};
