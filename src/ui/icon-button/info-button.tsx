import { InfoIcon } from "@yamada-ui/lucide";
import { FC, ui } from "@yamada-ui/react";
import { ComponentProps } from "react";

/**
 * インフォメーションアイコンのボタン
 */
export const InfoButton: FC<ComponentProps<"button">> = (props) => {
  return (
    <ui.button {...props}>
      <InfoIcon
        color="gray.200"
        _hover={{
          cursor: "pointer",
          color: "gray.400",
        }}
      />
    </ui.button>
  );
};
