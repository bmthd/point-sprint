"use client"

import type { MouseEvent } from "react"
import type { HTMLProps, PropGetter } from "@yamada-ui/react"
import type { FieldProps } from "@yamada-ui/react/components/field"
import { useCallback } from "react"
import { mergeProps, handlerAll, mergeRefs } from "@yamada-ui/react"
import { useControllableState } from "@yamada-ui/react/hooks/use-controllable-state"
import { useI18n } from "@yamada-ui/react/providers/i18n-provider"
import { useFieldProps } from "@yamada-ui/react/components/field"

export interface UsePasswordInputProps extends HTMLProps<"input">, FieldProps {
  /**
   * Determines whether the password input is visible by default.
   *
   * @default false
   */
  defaultVisible?: boolean
  /**
   * Determines the visibility of the password input.
   *
   * @default false
   */
  visible?: boolean
  /**
   * Callback function that is triggered when the visibility of the password input changes.
   */
  onVisibleChange?: (visible: boolean) => void
}

export const usePasswordInput = (props: UsePasswordInputProps = {}) => {
  const {
    props: {
      defaultVisible,
      disabled,
      visible: visibleProp,
      onVisibleChange,
      ...rest
    },
    ariaProps,
    dataProps,
    eventProps,
  } = useFieldProps(props)
  const [visible, setVisible] = useControllableState({
    defaultValue: defaultVisible,
    value: visibleProp,
    onChange: onVisibleChange,
  })
  const { t } = useI18n("passwordInput")

  const onChangeVisibility = useCallback(
    (ev: MouseEvent<HTMLButtonElement>) => {
      if (disabled || ev.button !== 0) return

      ev.preventDefault()

      setVisible((prev) => !prev)
    },
    [disabled, setVisible],
  )

  const getInputProps: PropGetter<"input"> = useCallback(
    ({ ref, ...props } = {}) => {
      const mergedProps = mergeProps(
        {
          type: visible ? "text" : "password",
          disabled,
          ...ariaProps,
          ...dataProps,
        },
        rest,
        props,
      )({
        mergeEvent: false,
        mergeRef: false,
      })

      return {
        ...mergedProps,
        ref: mergeRefs(ref, rest.ref),
        onBlur: handlerAll(eventProps.onBlur, props.onBlur),
        onFocus: handlerAll(eventProps.onFocus, props.onFocus),
      }
    },
    [visible, rest, disabled, dataProps, eventProps, ariaProps],
  )

  const getButtonProps: PropGetter<"button"> = useCallback(
    (props = {}) => ({
      type: "button",
      "aria-label": t("Toggle password visibility"),
      disabled,
      ...dataProps,
      ...props,
      onClick: handlerAll(props.onClick, onChangeVisibility),
    }),
    [onChangeVisibility, dataProps, disabled, t],
  )

  return {
    setVisible,
    visible,
    getButtonProps,
    getInputProps,
  }
}

export type UsePasswordInputReturn = ReturnType<typeof usePasswordInput>
