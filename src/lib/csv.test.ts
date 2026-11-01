import { describe, expect, it } from "vitest";
import { csvCell, pesos, toCsv } from "./csv";

describe("csvCell", () => {
  it.each([
    ["plain", "plain"],
    ["has, comma", '"has, comma"'],
    ['says "hi"', '"says ""hi"""'],
    ["two\nlines", '"two\nlines"'],
    ["", ""],
    [null, ""],
    [undefined, ""],
    [12, "12"],
    [Number.NaN, ""],
  ])("writes %j as %j", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it.each([
    ['=HYPERLINK("http://evil.example","Click")', `"'=HYPERLINK(""http://evil.example"",""Click"")"`],
    ["+639171234567", "'+639171234567"],
    ["-5", "'-5"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tcmd", "'\tcmd"],
  ])("stops %j from running as a formula", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it("leaves real negative numbers as numbers", () => {
    expect(csvCell(-5)).toBe("-5");
  });
});

describe("toCsv", () => {
  it("adds a byte-order mark and CRLF line endings", () => {
    expect(toCsv(["Name", "Total"], [["Ana, B.", "450.00"], ["Ñino", "₱"]])).toBe(
      '﻿Name,Total\r\n"Ana, B.",450.00\r\nÑino,₱\r\n',
    );
  });
});

it("formats centavos as pesos", () => {
  expect(pesos(45050)).toBe("450.50");
  expect(pesos(0)).toBe("0.00");
  expect(pesos(100000000)).toBe("1000000.00");
});
