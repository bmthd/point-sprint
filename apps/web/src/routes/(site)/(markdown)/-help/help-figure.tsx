import { Box, type CSSObject, Grid, List, SystemProvider, Text, dataAttr } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { Children, type ReactNode } from "react";
import { type HelpFigureScreen, type HelpFigureSpec, helpFigures } from "./figures.tsx";
import type { HelpFigureMark } from "./figure-marks.ts";
import { SampleProviders } from "./sample-providers.tsx";

/** The width of a phone the figure is drawn at, before it is shrunk into its column. */
const PHONE_WIDTH = 375;
/**
 * Room around the phone's page, wider than a phone's 16px so a number at the corner of a mark at
 * the page's edge stays inside the figure. The page keeps a phone's width.
 */
const FRAME_PADDING = 24;
/** How much the phone is shrunk: 375px and the extra room into 313px. */
const PHONE_ZOOM = 0.8;
/** The plan page's left column on a 1470px window, as a MacBook shows it, where its tables are. */
const WIDE_WIDTH = 848;
/** How much the wide screen is shrunk: 848px and the room around it into the help's 638px column. */
const WIDE_ZOOM = 0.7;
/**
 * The help's column is narrower than 638px on a narrow PC, down to 535px where the wide figures
 * start: in a figure narrower than the screen at `WIDE_ZOOM` and its border, it is shrunk more.
 */
const WIDE_NARROWER = [
  { maxInlineSize: "629px", css: { zoom: 0.65 } },
  { maxInlineSize: "586px", css: { zoom: 0.59 } },
];
/** How far a mark's outline stands off what it marks, and how thick it is, on the phone. */
const OUTLINE_OFFSET = 5;
const OUTLINE_WIDTH = 3;
/** A mark's number, on the phone before it is shrunk. */
const NUMBER_SIZE = 27;

/**
 * The app's config, but with breakpoints that ask the figure's width instead of the window's: on a
 * desktop the components inside still lay themselves out as on a phone.
 */
const figureConfig = {
  ...config,
  breakpoint: { ...config.breakpoint, identifier: "@container" as const },
};

/**
 * How each screen is drawn. A wide figure keeps the window's breakpoints: it shows only on a
 * window as wide as the plan page's two columns, where the components lay themselves out as there.
 */
const screens = {
  phone: {
    width: PHONE_WIDTH + (FRAME_PADDING - 16) * 2,
    zoom: PHONE_ZOOM,
    narrower: [],
    config: figureConfig,
  },
  wide: { width: WIDE_WIDTH + FRAME_PADDING * 2, zoom: WIDE_ZOOM, narrower: WIDE_NARROWER, config },
};

/** Where a figure of each screen shows: a wide one with the plan page's two columns. */
const screenDisplay = {
  phone: { base: "none", lg: "grid" },
  wide: { base: "grid", lg: "none" },
  both: "grid",
} as const;

/**
 * The marks' colors, set once on the figure for the outlines, the numbers on them and the numbers
 * beside them. Custom properties, as a number's own `_dark` inside `::before` is not drawn.
 */
const markColors: CSSObject = {
  "--help-mark": "{colors.blue.500}",
  "--help-mark-fg": "{colors.white}",
  _dark: { "--help-mark": "{colors.blue.300}", "--help-mark-fg": "{colors.black}" },
};

/** The number in a mark's corner and beside its point: the same circle. */
const markNumber: CSSObject = {
  boxSize: "22px",
  rounded: "full",
  bg: "var(--help-mark)",
  color: "var(--help-mark-fg)",
  fontSize: "xs",
  fontWeight: "bold",
  lineHeight: "22px",
  textAlign: "center",
};

/**
 * The marks drawn on the elements they point at, by CSS: they are in the HTML rendered ahead of
 * time along with the figure, and follow what they mark wherever the component puts it. A mark's
 * number sits on its outline's top left corner, over the line. The figure is shrunk, so the
 * number is drawn larger to look like the circles beside the figure.
 */
function markStyles(marks: HelpFigureMark[], zoom: number): CSSObject {
  // A screen shrunk more draws its marks larger, to look as large as the phone's.
  const scale = PHONE_ZOOM / zoom;
  const outlineWidth = OUTLINE_WIDTH * scale;
  const numberSize = NUMBER_SIZE * scale;
  const styles: CSSObject = {};
  for (const [index, mark] of marks.entries()) {
    const offset = (mark.offset ?? OUTLINE_OFFSET) * scale;
    // The number's middle on the outline's corner: out by `offset` and half the outline.
    const corner = `${-(offset + outlineWidth / 2 + numberSize / 2)}px`;
    styles[`& :is(${mark.selector})`] = {
      position: "relative",
      // A button clips what overflows it, its own number too.
      overflow: "visible !important",
      outline: `${outlineWidth}px solid`,
      outlineColor: "var(--help-mark)",
      outlineOffset: `${offset}px`,
      rounded: "md",
      _before: {
        ...markNumber,
        content: `"${index + 1}"`,
        position: "absolute",
        top: corner,
        left: corner,
        boxSize: `${numberSize}px`,
        lineHeight: `${numberSize}px`,
        fontSize: `calc({fontSizes.sm} * ${scale})`,
        zIndex: "1",
      },
    };
    // A box that clips what overflows it, an accordion's panel or a row that scrolls, would cut
    // the number off: what holds a mark lets it show.
    // `!important`: a component's own `overflow`, a card's, comes after these rules.
    // `:is()` matches the selector in the whole page, so the boxes between the start of the
    // selector and what it marks hold it too.
    styles[`& :has(:is(${mark.selector}))`] = { overflow: "visible !important" };
  }
  // An open accordion's panel clips by its own box, and so does its content's box.
  styles["& .ui-native-accordion__panel, & details::details-content"] = {
    overflow: "visible !important",
  };
  return styles;
}

/** What a figure leaves out of its screen. */
function hideStyles(selectors: string[] | undefined): CSSObject {
  const styles: CSSObject = {};
  if (selectors) styles[`& :is(${selectors.join(", ")})`] = { display: "none !important" };
  return styles;
}

/**
 * The app's own components drawing a sample plan, as a picture: shrunk like a screenshot, with
 * interaction disabled, and read as one image by its label. Numbered marks point at its parts.
 */
function FigureFrame({
  spec,
  screen,
  alt,
}: {
  spec: HelpFigureSpec;
  screen: HelpFigureScreen;
  alt: string;
}) {
  const Render = spec.render;
  const { crop } = spec;
  const { width, zoom, narrower, config: screenConfig } = screens[screen];
  return (
    <Box
      role="img"
      aria-label={alt}
      w="fit-content"
      maxW="full"
      bg="bg"
      borderWidth="1px"
      borderColor="border"
      rounded="l4"
      overflow="hidden"
    >
      <Box
        inert
        data-help-figure={spec.name}
        // A cropped screen shows its top, or with `data-end` its bottom, without measuring: the
        // same ahead of time.
        h={crop?.height}
        overflow="hidden"
        display="flex"
        flexDirection="column"
        _child={{ flexShrink: 0 }}
        data-end={dataAttr(crop?.from === "bottom")}
        _end={{ justifyContent: "flex-end" }}
        w={`${width}px`}
        p={`${FRAME_PADDING}px`}
        containerType="inline-size"
        _container={narrower}
        css={{ zoom, ...hideStyles(spec.hide), ...markStyles(spec.marks, zoom) }}
      >
        <SystemProvider theme={theme} config={screenConfig}>
          <SampleProviders>
            <Render />
          </SampleProviders>
        </SystemProvider>
      </Box>
    </Box>
  );
}

/** The figure and its numbered explanations, with all copy supplied by the Markdown. */
export function HelpFigure({
  name,
  caption,
  alt,
  children,
}: {
  name: string;
  caption: string;
  alt: string;
  children?: ReactNode;
}) {
  const spec = helpFigures[name];
  // Unreachable: the Markdown extension rejects a name without a figure.
  if (!spec) throw new Error(`No help figure is named ${name}.`);
  const withPoints = Children.count(children) > 0;
  const screen = spec.screen ?? "phone";
  // A phone beside its points; a wide screen, as wide as the column, above them.
  const beside = withPoints && screen === "phone";
  const display = screenDisplay[spec.screen ?? "both"];
  return (
    <Grid
      as="figure"
      // The column it is in, which a wide figure fits itself into.
      containerType="inline-size"
      display={display}
      templateColumns={
        beside ? { base: "315px minmax(0, 1fr)", sm: "minmax(0, 1fr)" } : "minmax(0, 1fr)"
      }
      gap="6"
      my="lg"
      mx="0"
      alignItems="start"
      css={markColors}
    >
      <Box>
        <FigureFrame spec={spec} screen={screen} alt={alt} />
        <Text as="figcaption" fontSize="xs" color="fg.muted" mt="1.5">
          {caption}
        </Text>
      </Box>
      {withPoints ? (
        <List.Root as="ol" gap="3.5" lineHeight="1.9">
          {children}
        </List.Root>
      ) : null}
    </Grid>
  );
}

/** One numbered point beside a figure, numbered as its mark. */
export function HelpFigureCallout({ step, children }: { step: string; children?: ReactNode }) {
  return (
    <List.Item display="grid" gridTemplateColumns="22px minmax(0, 1fr)" gap="2.5">
      <Box mt="1" css={markNumber} aria-hidden>
        {step}
      </Box>
      <Box css={{ "& > p": { margin: 0 } }}>{children}</Box>
    </List.Item>
  );
}
