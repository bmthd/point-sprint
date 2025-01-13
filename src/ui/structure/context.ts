import { createContext, useContext } from "react";

export const HeadingLevelContext = createContext({ level: 1 });

/**
 * 見出しレベルを取得する
 */
export const useLevel = () => {
  const context = useContext(HeadingLevelContext);
  return context.level;
};
