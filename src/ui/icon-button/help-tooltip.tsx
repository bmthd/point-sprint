import { CircleHelpIcon } from "@yamada-ui/lucide";
import { FC, Tooltip, TooltipProps } from "@yamada-ui/react";

/**
 * ヘルプアイコンツールチップ
 */
export const HelpTooltip: FC<TooltipProps> = (props) => {
  return (
    <Tooltip {...props}>
      <CircleHelpIcon
        color="gray.200"
        _hover={{
          cursor: "pointer",
          color: "gray.400",
        }}
      />
    </Tooltip>
  );
};
