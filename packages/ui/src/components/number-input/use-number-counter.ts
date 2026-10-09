"use client"

import type { HTMLProps, PropGetter } from "@yamada-ui/react"
import type { UseCounterProps, UseCounterReturn } from "@yamada-ui/react/hooks/use-counter"
import type { UseSpinnerProps } from "./use-spinner"
import { useCallback, useRef } from "react"
import {
  mergeProps,
  handlerAll,
  mergeRefs,
  useAttributeObserver,
} from "@yamada-ui/react"
import { useI18n } from "@yamada-ui/react/providers/i18n-provider"
import { useSpinner } from "./use-spinner"

export interface UseNumberCounterProps
  extends
    HTMLProps<"button">,
    Pick<UseCounterProps, "keepWithinRange">,
    Pick<UseCounterReturn, "max" | "min">,
    UseSpinnerProps {}

export const useNumberCounter = ({
  decrement,
  disabled,
  increment,
  keepWithinRange,
  max,
  min,
  ...rest
}: UseNumberCounterProps) => {
  const incrementRef = useRef<HTMLButtonElement>(null)
  const decrementRef = useRef<HTMLButtonElement>(null)
  const { down, spinning, stop, up } = useSpinner({ decrement, increment })
  const { t } = useI18n("numberInput")

  useAttributeObserver(incrementRef, ["disabled"], spinning, stop)
  useAttributeObserver(decrementRef, ["disabled"], spinning, stop)

  const getButtonProps: PropGetter<"button"> = useCallback(
    (props = {}) =>
      mergeProps(
        {
          type: "button",
          disabled,
          tabIndex: -1,
        },
        rest,
        props,
        {
          onPointerLeave: stop,
          onPointerUp: stop,
        },
      )(),
    [rest, disabled, stop],
  )

  const getIncrementProps: PropGetter<"button"> = useCallback(
    ({ ref, ...props } = {}) => {
      const trulyDisabled = disabled || (keepWithinRange && max)

      return {
        ref: mergeRefs(ref, incrementRef),
        "aria-label": t("Increase"),
        ...getButtonProps({ disabled: trulyDisabled, ...props }),
        onPointerDown: handlerAll(props.onPointerDown, (ev) => {
          if (ev.button !== 0 || trulyDisabled) return

          ev.preventDefault()
          up()
        }),
      }
    },
    [getButtonProps, disabled, keepWithinRange, max, up, t],
  )

  const getDecrementProps: PropGetter<"button"> = useCallback(
    ({ ref, ...props } = {}) => {
      const trulyDisabled = disabled || (keepWithinRange && min)

      return {
        ref: mergeRefs(ref, decrementRef),
        "aria-label": t("Decrease"),
        ...getButtonProps({ disabled: trulyDisabled, ...props }),
        onPointerDown: handlerAll(props.onPointerDown, (ev) => {
          if (ev.button !== 0 || trulyDisabled) return

          ev.preventDefault()
          down()
        }),
      }
    },
    [getButtonProps, disabled, keepWithinRange, min, down, t],
  )

  return { getDecrementProps, getIncrementProps }
}

export type UseNumberCounterReturn = ReturnType<typeof useNumberCounter>
