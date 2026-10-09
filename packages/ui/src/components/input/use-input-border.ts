import type { CSSProps, CSSVariableProps } from "@yamada-ui/react"
import { useMemo } from "react"
import { varAttr } from "@yamada-ui/react"

export interface UseInputBorderProps {
  /**
   * The border color when the input is invalid.
   */
  errorBorderColor?: CSSProps["borderColor"]
  /**
   * The border color when the input is focused.
   */
  focusBorderColor?: CSSProps["borderColor"]
}

export const useInputBorder = ({
  errorBorderColor,
  focusBorderColor,
}: UseInputBorderProps = {}) => {
  return useMemo<CSSVariableProps>(
    () => ({
      "--error-border-color": varAttr(errorBorderColor, "colors"),
      "--focus-border-color": varAttr(focusBorderColor, "colors"),
    }),
    [errorBorderColor, focusBorderColor],
  )
}

export type UseInputBorderReturn = ReturnType<typeof useInputBorder>
