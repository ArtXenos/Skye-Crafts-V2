// Small helpers for building sentences from the owner's settings, which may be
// empty: an empty setting must leave out its sentence, not leave "Pickup is in ."

/** Trimmed, and ending with a full stop (or ! or ?). Empty stays empty. */
export function asSentence(text: string | null | undefined) {
  const value = (text ?? "").trim();
  if (!value) return "";
  return /[.!?…)"']$/.test(value) ? value : `${value}.`;
}

/** Joins the non-empty parts as sentences: joinSentences("a", "", "b.") === "a. b." */
export function joinSentences(...parts: (string | null | undefined | false)[]) {
  return parts
    .map((part) => asSentence(part || ""))
    .filter(Boolean)
    .join(" ");
}

/** "1 hour", "48 hours". */
export function hoursLabel(hours: string | number) {
  return `${hours} ${String(hours) === "1" ? "hour" : "hours"}`;
}
