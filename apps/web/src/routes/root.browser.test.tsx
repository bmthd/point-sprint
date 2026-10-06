import { Box, Button, UIProvider, useColorMode } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { type ReactNode, useEffect } from "react";
import { expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";

type ColorMode = "light" | "dark";

function ColorModeSwitch({ colorMode }: { colorMode: ColorMode }) {
  const { changeColorMode } = useColorMode();
  useEffect(() => changeColorMode(colorMode), [changeColorMode, colorMode]);
  return null;
}

async function renderInTheme(ui: ReactNode, colorMode: ColorMode) {
  await cleanup();
  return render(
    <UIProvider theme={theme} config={config}>
      <ColorModeSwitch colorMode={colorMode} />
      {ui}
    </UIProvider>,
  );
}

function backgroundOf(testId: string) {
  return () => {
    const element = document.querySelector(`[data-testid="${testId}"]`);
    return element ? getComputedStyle(element).backgroundColor : undefined;
  };
}

test.each([
  { colorMode: "light", expected: "rgb(191, 0, 0)" },
  { colorMode: "dark", expected: "rgb(163, 0, 0)" },
] as const)(
  "primary solid button uses the brand color ($colorMode)",
  async ({ colorMode, expected }) => {
    await renderInTheme(
      <Button data-testid="button" colorScheme="primary" variant="solid">
        保存
      </Button>,
      colorMode,
    );

    await expect.poll(backgroundOf("button")).toBe(expected);
  },
);

// Yamada UI exposes a token's `base` key under the parent name: `point.base` is `point`.
const pointTokens = ["point", "point.spu", "point.marathon", "point.campaign"] as const;

test.each([
  {
    colorMode: "light",
    expected: {
      point: "rgb(163, 163, 163)",
      "point.spu": "rgb(92, 92, 92)",
      "point.marathon": "rgb(191, 0, 0)",
      "point.campaign": "rgb(247, 178, 59)",
    },
  },
  {
    colorMode: "dark",
    expected: {
      point: "rgb(71, 71, 71)",
      "point.spu": "rgb(138, 138, 138)",
      "point.marathon": "rgb(242, 82, 82)",
      "point.campaign": "rgb(249, 195, 103)",
    },
  },
] as const)("point tokens resolve in both themes ($colorMode)", async ({ colorMode, expected }) => {
  await renderInTheme(
    pointTokens.map((token) => <Box key={token} data-testid={token} bg={token} />),
    colorMode,
  );

  for (const token of pointTokens) {
    await expect.poll(backgroundOf(token)).toBe(expected[token]);
  }
});

test.each([
  {
    colorMode: "light",
    expected: {
      base: "rgb(245, 245, 245)",
      panel: "rgb(255, 255, 255)",
      emphasized: "rgb(143, 143, 143)",
    },
  },
  {
    colorMode: "dark",
    expected: {
      base: "rgb(18, 18, 18)",
      panel: "rgb(30, 30, 30)",
      emphasized: "rgb(110, 110, 110)",
    },
  },
] as const)(
  "surface tokens use the design-system values ($colorMode)",
  async ({ colorMode, expected }) => {
    await renderInTheme(
      <>
        <Box data-testid="bg" bg="bg" />
        <Box data-testid="bg.panel" bg="bg.panel" />
        <Box data-testid="border.emphasized" bg="border.emphasized" />
      </>,
      colorMode,
    );

    await expect.poll(backgroundOf("bg")).toBe(expected.base);
    await expect.poll(backgroundOf("bg.panel")).toBe(expected.panel);
    await expect.poll(backgroundOf("border.emphasized")).toBe(expected.emphasized);
  },
);
