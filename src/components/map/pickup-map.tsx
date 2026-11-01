"use client";

import { LeafletMap } from "@/components/map/leaflet-map";
import { directionsUrl, openStreetMapUrl, parseCoordinates } from "@/lib/geo";

const linkStyle =
  "inline-flex min-h-11 items-center rounded-full bg-white px-4 font-semibold text-ink ring-2 ring-line hover:ring-ink";

/** The pickup place on a map, with links that open a phone's map app. */
export function PickupMap({ coordinates }: { coordinates: string }) {
  const point = parseCoordinates(coordinates);
  if (!point) return null;
  return (
    <div className="grid gap-3">
      <LeafletMap point={point} label="Map of the pickup place" />
      <div className="flex flex-wrap gap-3">
        <a href={directionsUrl(point)} target="_blank" rel="noopener noreferrer" className={linkStyle}>
          Get directions (Google Maps)
        </a>
        <a href={openStreetMapUrl(point)} target="_blank" rel="noopener noreferrer" className={linkStyle}>
          Open in OpenStreetMap
        </a>
      </div>
    </div>
  );
}
