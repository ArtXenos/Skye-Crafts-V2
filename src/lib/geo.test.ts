import { describe, expect, it } from "vitest";
import { directionsUrl, formatCoordinates, parseCoordinates } from "./geo";

describe("parseCoordinates", () => {
  it.each([
    ["7.0731, 125.6128", { lat: 7.0731, lng: 125.6128 }],
    ["7.0731,125.6128", { lat: 7.0731, lng: 125.6128 }],
    ["  7.0731 125.6128 ", { lat: 7.0731, lng: 125.6128 }],
    ["-33.8688, 151.2093", { lat: -33.8688, lng: 151.2093 }],
    ["https://www.google.com/maps/@7.0731,125.6128,17z", { lat: 7.0731, lng: 125.6128 }],
    ["https://maps.google.com/?q=7.0731,125.6128", { lat: 7.0731, lng: 125.6128 }],
    ["https://www.google.com/maps/search/?api=1&query=7.0731%2C125.6128", { lat: 7.0731, lng: 125.6128 }],
    ["https://www.openstreetmap.org/?mlat=7.0731&mlon=125.6128#map=18/7.0731/125.6128", { lat: 7.0731, lng: 125.6128 }],
    ["https://www.openstreetmap.org/#map=17/7.0731/125.6128", { lat: 7.0731, lng: 125.6128 }],
  ])("reads %s", (input, expected) => {
    expect(parseCoordinates(input)).toEqual(expected);
  });

  it("prefers the pin over the map's centre in a Google Maps place link", () => {
    const link = "https://www.google.com/maps/place/UIC/@7.0700,125.6000,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d7.0731!4d125.6128";
    expect(parseCoordinates(link)).toEqual({ lat: 7.0731, lng: 125.6128 });
  });

  it.each([
    [""],
    ["Davao City"],
    ["125.6128, 7.0731"], // swapped: latitude can't be 125
    ["91, 0"],
    ["7.0731"],
    ["https://maps.app.goo.gl/AbCdEf"], // short links hide the numbers
    ["9".repeat(2001)],
  ])("rejects %s", (input) => {
    expect(parseCoordinates(input)).toBeNull();
  });
});

describe("formatCoordinates", () => {
  it("stores six decimals", () => {
    expect(formatCoordinates({ lat: 7.0731, lng: 125.6128 })).toBe("7.073100,125.612800");
    expect(formatCoordinates({ lat: -0.1234567, lng: -1 })).toBe("-0.123457,-1.000000");
  });
});

it("builds a directions link", () => {
  expect(directionsUrl({ lat: 7.0731, lng: 125.6128 })).toBe(
    "https://www.google.com/maps/dir/?api=1&destination=7.0731,125.6128",
  );
});
