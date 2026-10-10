import { expect, test } from "vitest";
import { imageSize } from "./-share/result-card";
import { renderResultImage } from "./-result-image";

test("the result's OGP image is a PNG of the OGP size", async () => {
  const png = Buffer.from(await renderResultImage({ points: 2600, rate: 6.5 }));
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  // The IHDR chunk's width and height.
  expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual(imageSize);
});
