import { render } from "takumi-js";
import fonts from "virtual:og-fonts";
import { type ResultFigures, cardFontFamily, imageSize, resultCard } from "./-share/result-card";

const decode = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

const cardFonts = fonts.map(({ weight, data }) => ({
  name: cardFontFamily,
  weight,
  data: decode(data),
}));

/** The result's OGP image as PNG. Takumi runs as WebAssembly in the Worker and natively in Node. */
export const renderResultImage = (figures: ResultFigures) =>
  render(resultCard(figures), { ...imageSize, fonts: cardFonts });
