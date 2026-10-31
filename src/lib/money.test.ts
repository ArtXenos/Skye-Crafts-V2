import { describe, expect, it } from "vitest";
import { centsToPesoInput, formatPeso, pesoToCents } from "./money";

describe("formatPeso", () => {
  it("drops .00 and keeps real centavos", () => {
    expect(formatPeso(45000)).toBe("₱450");
    expect(formatPeso(150050)).toBe("₱1,500.50");
    expect(formatPeso(5)).toBe("₱0.05");
  });
});

describe("pesoToCents", () => {
  it.each([
    ["450", 45000],
    ["450.5", 45050],
    ["450.05", 45005],
    ["1,200.99", 120099],
    [" 0.10 ", 10],
    [19.99, 1999],
  ])("reads %j as %i centavos", (input, cents) => {
    expect(pesoToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "-5", "1.234", "1e3", "₱450"])("rejects %j", (input) => {
    expect(pesoToCents(input)).toBeNull();
  });

  it("round-trips with centsToPesoInput", () => {
    for (const cents of [1, 99, 100, 45000, 45050, 9999999]) {
      expect(pesoToCents(centsToPesoInput(cents))).toBe(cents);
    }
  });
});
