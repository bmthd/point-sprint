"use client";
import { H } from "@/ui/structure/h";
import { faFacebook, faLine, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@yamada-ui/fontawesome";
import { ClipboardCopyIcon } from "@yamada-ui/lucide";
import { Card, HStack, IconButton, IconButtonProps } from "@yamada-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

/**
 * シェアボタンコンテナ
 */
export const ShareButtonContainer = () => {
  const [title, setTitle] = useState("");
  useEffect(() => {
    setTitle(document.title);
  }, []);
  const pathname = usePathname();

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(`${title} ${pathname}`);
    alert("クリップボードにコピーしました！");
  };

  const buttons = [
    {
      label: "Twitter",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        title,
      )}&url=${encodeURIComponent(pathname)}`,
      icon: <FontAwesomeIcon icon={faXTwitter} />,
      bg: "blackAlpha.900",
      _hover: { bg: "blackAlpha.800" },
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pathname)}`,
      icon: <FontAwesomeIcon icon={faFacebook} />,
      // style: { backgroundColor: "#1877f2" },
      colorScheme: "blue",
    },
    {
      label: "LINE",
      href: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(pathname)}`,
      icon: <FontAwesomeIcon icon={faLine} />,
      // style: { backgroundColor: "#00b900" },
      colorScheme: "green",
    },
  ] as const satisfies ({ label: string; href: string; icon: ReactNode } & IconButtonProps)[];

  return (
    <Card>
      <H>このページをシェア</H>
      <HStack>
        {buttons.map(({ href, label, ...props }) => (
          <Link key={label} href={href}>
            <IconButton {...props} />
          </Link>
        ))}
        <IconButton
          icon={<ClipboardCopyIcon />}
          onClick={copyToClipboard}
          aria-label="クリップボードにコピー"
          bg="blue.900"
          _hover={{ bg: "blue.800" }}
        />
      </HStack>
    </Card>
  );
};
