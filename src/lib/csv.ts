// Turning rows into a CSV file that opens cleanly in Excel and Google Sheets.

export type CsvValue = string | number | null | undefined;

/**
 * One cell. Two jobs:
 * 1. Quote it when it contains a comma, quote or line break (RFC 4180).
 * 2. Defuse "formula injection": a customer could type a name like
 *    =HYPERLINK("http://evil","Click"), and Excel would run it as a formula
 *    when the owner opens the file. Text starting with = + - @ (or a tab or
 *    carriage return) gets a leading apostrophe, which Excel shows as plain
 *    text. Real numbers are left alone so they stay numbers.
 */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

/**
 * The whole file. Starts with a byte-order mark so Excel reads it as UTF-8
 * (otherwise ₱, ñ and emoji turn into gibberish), and uses CRLF line endings
 * as the CSV standard says.
 */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Centavos as a plain number of pesos with two decimals, e.g. 45050 → "450.50". */
export function pesos(cents: number) {
  return (cents / 100).toFixed(2);
}
