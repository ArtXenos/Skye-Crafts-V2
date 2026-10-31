/**
 * Where to send someone after logging in, from a `?next=` value. Only paths
 * on this site are allowed, so a link like /login?next=https://evil.example
 * (or tricks such as "//evil.example" or "/\t/evil.example", which browsers
 * read as another site) can't send a customer to a fake page right after a
 * real login. Anything doubtful falls back to `fallback`.
 */
export function safeNextPath(value: unknown, fallback = "/account") {
  if (typeof value !== "string" || value.length > 500) return fallback;
  // Control characters and backslashes are ignored or rewritten by browsers.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;

  const base = "http://same.invalid";
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
