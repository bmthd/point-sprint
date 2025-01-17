import { FC } from "react";
import { HStack, Text } from "@yamada-ui/react";

export const CountDisplay: FC<{ count: number; unit: string }> = ({ count, unit }) => {
  return (
    <HStack border={2} borderColor="gray.300" borderRadius="md" p={2} bg="">
      <Text>{count}</Text>
      <Text>{unit}</Text>
    </HStack>
  );
};
