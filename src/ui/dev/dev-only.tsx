import { env } from "process";
import { FC, ReactNode } from "react";

/**
 * 開発環境のみ表示するコンポーネント
 * ```tsx
 * const DebugComponent = React.lazy(() => import("./debug-component"));
 *
 * export const MyComponent: FC = () => (
 *  <DevOnly>
 *   <DebugComponent />
 *  </DevOnly>
 * );
 */
export const DevOnly: FC<{ children?: ReactNode }> = ({ children }) => {
  const isDev = env.NODE_ENV === "development";
  return isDev ? <>{children}</> : null;
};
