import { defineTheme } from "@yamada-ui/react";
import { semanticTokens } from "./semantic-tokens/index.ts";
import { styles } from "./styles/index.ts";
import { tokens } from "./tokens/index.ts";

export { config } from "./config.ts";

/**
 * The default theme of Yamada UI.
 *
 * @see https://yamada-ui.com/docs/theming
 */
export const theme = defineTheme({
  styles,
  ...tokens,
  semanticTokens,
});
