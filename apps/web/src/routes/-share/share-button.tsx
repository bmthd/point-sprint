import {
  Box,
  Button,
  Center,
  HStack,
  IconButton,
  Image,
  LinkIcon,
  type StackProps,
  Text,
  VStack,
  useClipboard,
} from "@workspaces/ui";
import { useId, useState } from "react";
import { ShareIcon } from "../../ui/icons";
import facebookLogo from "./facebook-logo.svg";
import lineLogo from "./line-logo.svg";
import xLogo from "./x-logo.svg";
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
  label,
  target,
  ...rest
}: { label: string; target: ShareTarget } & StackProps) {
  const [open, setOpen] = useState(false);
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
      <Button
        variant="outline"
        bg="bg.panel"
        size="lg"
        startIcon={<ShareIcon />}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => void share()}
      >
        {label}
      </Button>
      <Box id={panelId} hidden={!open}>
        {open ? <ShareLinks target={target} /> : null}
      </Box>
    </VStack>
  );
}

/**
 * Each service's logo from its brand resources on a 40px square of its color, all with the same
 * corners. The files are the logos' paths: X's on a square of its black, Facebook's and LINE's
 * with the circle or the rounded square under them made the full square.
 */
const serviceIcons = {
  X: <Image src={xLogo} alt="" boxSize="10" rounded="sm" />,
  Facebook: <Image src={facebookLogo} alt="" boxSize="10" rounded="sm" />,
  LINE: <Image src={lineLogo} alt="" boxSize="10" rounded="sm" />,
};

/**
 * The links to X, Facebook and LINE and a copy button: a row of icons, named for a screen reader,
 * with what the copy did under them.
 */
export function ShareLinks({ target }: { target: ShareTarget }) {
  const { copied, onCopy } = useClipboard();

  return (
    <VStack gap="2" alignItems="stretch">
      <HStack gap="3" justifyContent="center">
        {shareLinks(target).map((link) => (
          <IconButton
            key={link.service}
            as="a"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            boxSize="12"
            rounded="md"
            aria-label={link.label}
            icon={serviceIcons[link.service]}
          />
        ))}
        <IconButton
          variant="ghost"
          boxSize="12"
          rounded="md"
          aria-label="文面とリンクをコピー"
          onClick={() => onCopy(shareMessage(target))}
          icon={
            <Center boxSize="10" rounded="sm" bg="bg.muted" color="fg">
              <LinkIcon fontSize="xl" />
            </Center>
          }
        />
      </HStack>
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
