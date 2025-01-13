"use client";
import { HeadingLevelContext, useLevel } from "@/ui/structure/context";
import { useMemo, type ComponentProps, type ReactNode } from "react";

type SectionProps = ComponentProps<"section"> & {
  children: ReactNode;
};

/**
 * セクション
 */
export const Section = ({ ...props }: SectionProps) => {
  const currentLevel = useLevel();
  const value = useMemo(() => ({ level: Math.min(6, currentLevel + 1) }), [currentLevel]);
  return (
    <HeadingLevelContext.Provider value={value}>
      <section {...props} />
    </HeadingLevelContext.Provider>
  );
};
