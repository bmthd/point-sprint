import { ErrorMessage, FormControl, Grid, Label, SlideFade, Tag } from "@yamada-ui/react";
import { type ComponentProps, type FC } from "react";

/**
 * ラベルとエラーメッセージを紐付けたフォームコントロール
 * @param props FormControlProps
 */
export const CustomFormControl: FC<
  ComponentProps<typeof FormControl> & {
    /** ラベルを非表示にする場合に指定 */
    withoutLabel?: boolean;
    /** 必須,任意アイコンを表示にする場合に指定 */
    requireIcon?: boolean;
  }
> = ({
  children,
  label,
  isRequired,
  errorMessage,
  labelProps,
  errorMessageProps,
  withoutLabel = false,
  requireIcon = false,
  ...props
}) => (
  <FormControl replace {...props}>
    {!withoutLabel && (
      <Grid templateColumns="auto 1fr" alignItems="start" gap={1}>
        <Label {...labelProps}>{label}</Label>
        {requireIcon && (
          <Tag w="fit-content" size="sm" rounded="md" colorScheme={isRequired ? "red" : "blue"}>
            {isRequired ? "必須" : "任意"}
          </Tag>
        )}
      </Grid>
    )}
    {children}
    <SlideFade open={Boolean(errorMessage)}>
      <ErrorMessage role="alert" {...errorMessageProps}>
        {errorMessage}
      </ErrorMessage>
    </SlideFade>
  </FormControl>
);
