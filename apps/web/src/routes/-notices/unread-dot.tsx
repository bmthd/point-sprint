import { Indicator, type IndicatorProps } from "@workspaces/ui";

/**
 * The dot at the corner of `children` while there is a notice to read. Only a mark to see: what
 * it wraps says the same in its label for a screen reader.
 */
export function UnreadDot({ unread, ...rest }: { unread: boolean } & IndicatorProps) {
  return (
    <Indicator
      inline
      size="sm"
      colorScheme="primary"
      disabled={!unread}
      ping
      floatProps={{ "aria-hidden": true }}
      {...rest}
    />
  );
}
