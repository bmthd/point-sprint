import { extendTheme } from "@yamada-ui/react";
import components from "./components";
import tokens from "./tokens";

export default extendTheme({
  // styles,
  components,
  ...tokens,
})();
