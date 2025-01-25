import { Markdown } from "@yamada-ui/markdown";
import { FC } from "react";

export const JSONViewer: FC<{ value: unknown }> = ({ value }) => {
  const json = `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
  return <Markdown codeProps={{ theme: "vscDarkPlus" }}>{json}</Markdown>;
};
