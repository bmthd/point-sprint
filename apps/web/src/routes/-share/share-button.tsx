import {
  Box,
  Button,
  IconButton,
  type StackProps,
  Text,
  VStack,
  useClipboard,
} from "@workspaces/ui";
import { useId, useState } from "react";
import { ShareIcon } from "../../ui/icons";
import { type ShareTarget, shareLinks, shareMessage } from "./share-target";

/** Whether the device's own share sheet can post `target`. */
const canShareNatively = (target: ShareTarget) =>
  typeof navigator.share === "function" && (navigator.canShare?.(target) ?? true);

/**
 * A button that shares `target`. Where the device has a share sheet (the Web Share API) it opens
 * that; elsewhere, or when the sheet fails, it opens the links to X, Facebook and LINE and a copy
 * button. Which one is decided on the click, so the prerendered HTML is the same on every device.
 */
export function ShareButton({
  iconOnly = false,
  label,
  target,
  ...rest
}: { iconOnly?: boolean; label: string; target: ShareTarget } & StackProps) {
  const [open, setOpen] = useState(false);
  const { copied, onCopy } = useClipboard();
  const panelId = useId();

  const share = async () => {
    if (open || !canShareNatively(target)) {
      setOpen(!open);
      return;
    }
    try {
      await navigator.share(target);
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (!(error instanceof DOMException && error.name === "AbortError")) setOpen(true);
    }
  };

  return (
    <VStack gap="2" alignItems="stretch" {...rest}>
      {iconOnly ? (
        <IconButton
          aria-label={label}
          icon={<ShareIcon />}
          variant="ghost"
          colorScheme="gray"
          size="lg"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => void share()}
        />
      ) : (
        <Button
          variant="ghost"
          colorScheme="gray"
          size="lg"
          startIcon={<ShareIcon />}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => void share()}
        >
          {label}
        </Button>
      )}
      <Box id={panelId} hidden={!open}>
        {open ? (
          <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="2">
            {shareLinks(target).map((link) => (
              <Button
                key={link.service}
                as="a"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="lg"
                aria-label={link.label}
              >
                {link.service}
              </Button>
            ))}
            <Button
              variant="outline"
              size="lg"
              aria-label="文面とリンクをコピー"
              onClick={() => onCopy(shareMessage(target))}
            >
              コピー
            </Button>
          </Box>
        ) : null}
      </Box>
      <Text
        role="status"
        fontSize="sm"
        color="fg.muted"
        textAlign="center"
        _empty={{ display: "none" }}
      >
        {copied ? "文面とリンクをコピーしました" : ""}
      </Text>
    </VStack>
  );
}
