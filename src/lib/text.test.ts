import { describe, expect, it } from "vitest";
import { asSentence, hoursLabel, joinSentences } from "./text";

describe("asSentence", () => {
  it("adds a full stop when the text has none", () => {
    expect(asSentence("Pickup is in Davao City")).toBe("Pickup is in Davao City.");
    expect(asSentence("  1-3 days  ")).toBe("1-3 days.");
  });

  it.each([
    "Already a sentence.",
    "Order now!",
    "Can I cancel?",
    "More to come…",
    "We call it 'the bouquet'",
    'Ask for "the big one"',
    "Pickup on weekends (Saturday or Sunday)",
  ])("keeps %j as it is, without a second full stop", (text) => {
    expect(asSentence(text)).toBe(text);
  });

  it.each(["", "   ", "\n\t", null, undefined])("leaves %j empty", (text) => {
    expect(asSentence(text)).toBe("");
  });

  it("turns a single character into a sentence", () => {
    expect(asSentence("a")).toBe("a.");
  });
});

describe("joinSentences", () => {
  it("joins the parts as sentences", () => {
    expect(joinSentences("a", "b.")).toBe("a. b.");
    expect(joinSentences("Ready pieces: 1-3 days", "Custom pieces: Stated in your quotation")).toBe(
      "Ready pieces: 1-3 days. Custom pieces: Stated in your quotation.",
    );
  });

  it("drops empty, blank, missing and false parts", () => {
    expect(joinSentences("a", "", "b.")).toBe("a. b.");
    expect(joinSentences("   ", "a", undefined, null, false, "b")).toBe("a. b.");
  });

  it("gives an empty string when every part is empty", () => {
    expect(joinSentences()).toBe("");
    expect(joinSentences("", "  ", undefined, null, false)).toBe("");
  });

  it("never leaves an empty sentence like \"Pickup is in .\"", () => {
    const area = "";
    expect(joinSentences("Delivery anywhere", area && `Pickup is in ${area}`, "See your order page")).toBe(
      "Delivery anywhere. See your order page.",
    );
  });
});

describe("hoursLabel", () => {
  it.each([
    ["1", "1 hour"],
    [1, "1 hour"],
    ["48", "48 hours"],
    [48, "48 hours"],
    ["168", "168 hours"],
    ["0", "0 hours"],
  ])("labels %j as %j", (hours, label) => {
    expect(hoursLabel(hours)).toBe(label);
  });
});
