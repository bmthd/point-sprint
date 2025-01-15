"use client";
import { H } from "@/ui/structure/h";
import { faFacebook, faLine, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@yamada-ui/fontawesome";
import { ClipboardCopyIcon } from "@yamada-ui/lucide";
import { Card, HStack, IconButton, StyleProperties } from "@yamada-ui/react";
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
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        title,
      )}&url=${encodeURIComponent(pathname)}`,
      icon: <FontAwesomeIcon icon={faXTwitter} />,
      label: "Twitter",
      style: { bg: "white" },
    },
    {
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pathname)}`,
      icon: <FontAwesomeIcon icon={faFacebook} />,
      label: "Facebook",
      style: { backgroundColor: "#1877f2" },
    },
    {
      href: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(pathname)}`,
      icon: <FontAwesomeIcon icon={faLine} />,
      label: "LINE",
      style: { backgroundColor: "#00b900" },
    },
  ] as const satisfies { href: string; icon: ReactNode; label: string; style?: StyleProperties }[];

  return (
    <Card>
      <H>このページをシェア</H>
      <HStack>
        {buttons.map(({ href, icon, label, style }) => (
          <Link href={href} key={label}>
            <IconButton icon={icon} {...style} />
          </Link>
        ))}
        <IconButton
          icon={<ClipboardCopyIcon />}
          onClick={copyToClipboard}
          style={{ backgroundColor: "#333" }}
        />
      </HStack>
    </Card>
  );
};
