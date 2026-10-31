// Money is always handled as integer centavos; floating-point pesos are only
// for display. 45000 centavos = ₱450.

export function formatPeso(cents: number) {
  return (
    "₱" +
    (cents / 100).toLocaleString("en-PH", {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Parse what someone typed as a peso amount ("450", "1,200.50") into
 * centavos without floating-point rounding. Returns null if it isn't one.
 */
export function pesoToCents(input: string | number): number | null {
  const text = String(input).trim().replaceAll(",", "");
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const pesos = Number(match[1]);
  const centavos = Number((match[2] ?? "").padEnd(2, "0"));
  return pesos * 100 + centavos;
}

/** Centavos as an editable peso string ("450" or "450.50"). */
export function centsToPesoInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  const pesos = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(pesos) : `${pesos}.${String(rest).padStart(2, "0")}`;
}
