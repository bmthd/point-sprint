import { CountDisplay } from "@/ui/count-display";
import { useSPURate } from "@/views/top-page/store";
import { FC } from "react";

export const SPURate: FC = () => {
  const count = useSPURate();
  return <CountDisplay count={count} unit="倍" />;
};
