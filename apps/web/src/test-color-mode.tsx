import { useColorMode } from "@workspaces/ui";
import { useEffect } from "react";

export type TestColorModeValue = "light" | "dark";

/** Sets the Yamada UI color mode after its test provider has committed. */
export function TestColorMode({ value }: { value: TestColorModeValue }) {
  const { changeColorMode } = useColorMode();
  useEffect(() => changeColorMode(value), [changeColorMode, value]);
  return null;
}
