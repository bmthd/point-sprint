"use client"

import type { ChangeEvent } from "react"
import type {
  HTMLProps,
  HTMLRefAttributes,
  PropGetter,
  Merge,
} from "@yamada-ui/react"
import type { FieldProps } from "@yamada-ui/react/components/field"
import { useCallback, useMemo, useRef } from "react"
import {
  mergeProps,
  ariaAttr,
  dataAttr,
  handlerAll,
  isArray,
  isUndefined,
  mergeRefs,
  visuallyHiddenAttributes,
} from "@yamada-ui/react"
import { useControllableState } from "@yamada-ui/react/hooks/use-controllable-state"
import { useI18n } from "@yamada-ui/react/providers/i18n-provider"
import { useFieldProps } from "@yamada-ui/react/components/field"
import { useToggleGroupContext } from "./use-toggle-group"

export interface UseToggleProps<Y extends string = string>
  extends
    FieldProps,
    HTMLRefAttributes<"input">,
    Omit<HTMLProps<"button">, "onChange" | "ref" | "value"> {
  /**
   * If `true`, the toggle button is represented as active.
   *
   * @default false
   */
  active?: boolean
  /**
   * If `true`, the toggle button will be checked.
   */
  checked?: boolean
  /**
   * If `true`, the toggle button will be initially checked.
   *
   * @default false
   */
  defaultChecked?: boolean
  /**
   * The value of the toggle button.
   */
  value?: Y
  /**
   * The callback invoked when checked state changes.
   */
  onChange?: (checked: boolean) => void
}

export const useToggle = <Y extends string = string>(
  props: UseToggleProps<Y> = {},
) => {
  const { t } = useI18n("toggle")
  const {
    disabled: groupDisabled,
    readOnly: groupReadOnly,
    value: groupValue,
    onChange: onChangeGroup,
    onChangeMapRef,
  } = useToggleGroupContext() ?? {}
  const {
    props: {
      id,
      ref,
      form,
      name,
      active,
      checked: checkedProp,
      defaultChecked = false,
      disabled,
      readOnly,
      required,
      value,
      onChange: onChangeProp,
      ...rest
    },
    ariaProps,
    dataProps,
    eventProps,
  } = useFieldProps<HTMLElement, UseToggleProps<Y>>({
    disabled: groupDisabled,
    readOnly: groupReadOnly,
    ...props,
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const [checked, setChecked] = useControllableState({
    defaultValue: defaultChecked,
    value: checkedProp,
    onChange: onChangeProp,
  })
  const interactive = !(readOnly || disabled)
  const controlled = !isUndefined(groupValue)
  const trulyChecked = useMemo(() => {
    if (!controlled) return checked
    else
      return isArray(groupValue)
        ? groupValue.includes(value ?? "")
        : value === groupValue
  }, [controlled, groupValue, checked, value])

  if (controlled && isUndefined(value))
    console.warn(`Toggle: value is required. Please set the value.`)

  if (value) onChangeMapRef?.current.set(value, setChecked)

  const onClick = useCallback(() => {
    if (!interactive) return

    setChecked((prev) => !prev)
    onChangeGroup?.(value)
  }, [onChangeGroup, setChecked, value, interactive])

  const onChange = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      setChecked(ev.target.checked)
      onChangeGroup?.(value)
    },
    [onChangeGroup, setChecked, value],
  )

  const getInputProps: PropGetter<"input"> = useCallback(
    (props = {}) => ({
      ...visuallyHiddenAttributes,
      ...ariaProps,
      ...dataProps,
      ...eventProps,
      id,
      form,
      type: "checkbox",
      name,
      checked,
      disabled,
      readOnly,
      required,
      value,
      ...props,
      ref: mergeRefs(inputRef, ref, props.ref),
      onChange: handlerAll(props.onChange, onChange),
    }),
    [
      ariaProps,
      checked,
      dataProps,
      disabled,
      eventProps,
      form,
      id,
      name,
      onChange,
      readOnly,
      ref,
      required,
      value,
    ],
  )

  const getButtonProps: PropGetter<
    "button",
    undefined,
    Merge<HTMLProps<"button">, { "aria-label": string }>
  > = useCallback(
    (props = {}): Merge<HTMLProps<"button">, { "aria-label": string }> => {
      const ariaLabel = value?.toString() ?? t("Toggle button")
      const mergedProps = mergeProps(
        dataProps,
        {
          type: "button",
          "aria-disabled": ariaAttr(!interactive),
          "aria-label": ariaLabel,
          "aria-pressed": trulyChecked,
          "data-active": dataAttr(active),
          "data-checked": dataAttr(trulyChecked),
          disabled,
          tabIndex: interactive ? undefined : -1,
        },
        rest,
        props,
        { onClick },
      )()

      return {
        ...mergedProps,
        "aria-label": mergedProps["aria-label"] ?? ariaLabel,
      }
    },
    [
      dataProps,
      value,
      trulyChecked,
      active,
      disabled,
      rest,
      onClick,
      interactive,
      t,
    ],
  )

  return {
    checked: trulyChecked,
    setChecked,
    getButtonProps,
    getInputProps,
  }
}

export type UseToggleReturn = ReturnType<typeof useToggle>
