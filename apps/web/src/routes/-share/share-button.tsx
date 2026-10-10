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

/** The X logo from X's brand toolkit, in the color of the text on the square under it. */
function XLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 1200 1227" aria-hidden="true">
      <path
        fill="currentColor"
        d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"
      />
    </svg>
  );
}

/**
 * Each service's logo from its brand resources on a 40px square of its color, all with the same
 * corners. The Facebook and LINE files are their logos' paths with the circle or the rounded square
 * under them made the full square.
 */
const serviceIcons = {
  X: (
    <Center boxSize="10" rounded="sm" bg="fg" color="bg">
      <XLogo />
    </Center>
  ),
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
