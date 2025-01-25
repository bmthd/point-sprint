"use client";
import { Flex, HStack, Text } from "@yamada-ui/react";
import { FC } from "react";
import { CountNumber } from "./number";

export const CountDisplay: FC<{ count: number; unit: string }> = ({ count, unit }) => {
  return (
    <HStack>
      <Flex
        justifyContent="end"
        alignItems="center"
        borderWidth="2px"
        borderColor="gray.200"
        borderRadius="md"
        bgGradient="linear(to-b,blackAlpha.300,blackAlpha.50)"
        h={12}
        w={20}
        p="sm"
      >
        <Text color="brand" fontSize="xx-large" fontWeight="bold">
          <CountNumber count={count} duration={1000} />
        </Text>
      </Flex>
      <Text>{unit}</Text>
    </HStack>
  );
};
