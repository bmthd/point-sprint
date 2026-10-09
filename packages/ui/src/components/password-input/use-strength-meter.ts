"use client"

import type {
  HTMLProps,
  PropGetter,
  RequiredPropGetter,
} from "@yamada-ui/react"
import { useCallback } from "react"
import { mergeProps, dataAttr } from "@yamada-ui/react"
import { useI18n } from "@yamada-ui/react/providers/i18n-provider"

export interface UseStrengthMeterProps extends HTMLProps {
  /**
   * The value of the password strength meter.
   */
  value: number
  /**
   * The maximum value of the password strength meter.
   *
   * @default 4
   */
  max?: number
}

export const useStrengthMeter = ({
  max = 4,
  value,
  ...rest
}: UseStrengthMeterProps) => {
  const { t } = useI18n("passwordInput")

  const getRootProps: PropGetter = useCallback(
    (props) =>
      mergeProps(
        {
          "aria-label": t("Password strength meter"),
          "aria-valuemax": max,
          "aria-valuemin": 0,
          "aria-valuenow": value,
          role: "meter",
        },
        rest,
        props,
      )(),
    [max, rest, value, t],
  )

  const getIndicatorProps: RequiredPropGetter<"div", { index: number }> =
    useCallback(
      ({ index, ...props }) => ({
        "data-selected": dataAttr(index < value),
        ...props,
      }),
      [value],
    )

  return { getIndicatorProps, getRootProps }
}

export type UseStrengthMeterReturn = ReturnType<typeof useStrengthMeter>
