import { describe, expect, it } from "vitest";
import { fitWithin } from "./photo";

describe("fitWithin", () => {
  it.each([
    [4000, 3000, { width: 1600, height: 1200 }], // phone photo, landscape
    [3000, 4000, { width: 1200, height: 1600 }], // portrait
    [1600, 1600, { width: 1600, height: 1600 }],
    [800, 600, { width: 800, height: 600 }], // small photos aren't enlarged
    [10000, 3, { width: 1600, height: 1 }], // never 0 pixels
  ])("%i×%i → %o", (width, height, expected) => {
    expect(fitWithin(width, height)).toEqual(expected);
  });
});
