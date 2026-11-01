// Map pins: reading the coordinates the owner pastes in, and links that open
// the place in a phone's map app.

export type LatLng = { lat: number; lng: number };

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

// Tried in order. Google Maps puts the *map's centre* after "@" but the
// *pin* after "!3d…!4d…", so the pin wins when both are there.
const PATTERNS: RegExp[] = [
  new RegExp(String.raw`!3d${NUM}!4d${NUM}`), // Google Maps place link (the pin)
  new RegExp(String.raw`[?&](?:q|query|destination|ll)=${NUM},\s*${NUM}`), // ?q=7.07,125.61
  new RegExp(String.raw`mlat=${NUM}&mlon=${NUM}`), // OpenStreetMap marker link
  new RegExp(String.raw`@${NUM},${NUM}`), // Google Maps "@lat,lng,zoom"
  new RegExp(String.raw`#map=\d{1,2}/${NUM}/${NUM}`), // OpenStreetMap "#map=zoom/lat/lng"
  new RegExp(String.raw`^\s*${NUM}\s*[,\s]\s*${NUM}\s*$`), // "7.0731, 125.6128" or "7.0731 125.6128"
];

/**
 * Coordinates from what the owner pasted: "7.0731, 125.6128", or a Google
 * Maps / OpenStreetMap link. Null when there's no valid pair in it.
 */
export function parseCoordinates(input: string): LatLng | null {
  if (typeof input !== "string" || input.length > 2000) return null;
  let text = input.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    // Not URL-encoded (or badly encoded): use it as it is.
  }
  for (const pattern of PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (isValid(lat, lng)) return { lat, lng };
    return null; // found a pair, but it isn't a place (e.g. swapped)
  }
  return null;
}

function isValid(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** The stored form: "7.073100,125.612800" (6 decimals is about 10 cm). */
export function formatCoordinates({ lat, lng }: LatLng) {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Opens turn-by-turn directions in Google Maps (the app on phones). */
export function directionsUrl({ lat, lng }: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function openStreetMapUrl({ lat, lng }: LatLng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}
