"use client";

// A small OpenStreetMap map drawn with Leaflet. Leaflet needs `window`, so it
// is imported inside an effect: the server only renders the empty box, and
// the map appears once the page is running in the browser.
//
// Tiles come from tile.openstreetmap.org (allowed in the CSP in
// next.config.ts). Their usage policy asks for the attribution Leaflet shows
// in the corner and a normal amount of traffic, which a shop's order page is.
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";

const PHILIPPINES: [number, number] = [12.3, 122.5];

// A pin in the shop's colours, drawn with SVG so there are no image files to
// resolve (Leaflet's default marker images break under bundlers).
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">
  <path d="M17 43C17 43 32 27.5 32 17A15 15 0 0 0 2 17C2 27.5 17 43 17 43Z" fill="#a8435f" stroke="#fff" stroke-width="2.5"/>
  <circle cx="17" cy="17" r="6" fill="#fff9fa"/>
</svg>`;

type Props = {
  /** Where the pin is. Null shows the whole Philippines with no pin. */
  point: LatLng | null;
  /** Read out by screen readers, e.g. "Map of the pickup place". */
  label: string;
  /** When given, tapping the map moves the pin there (the admin picker). */
  onPick?: (point: LatLng) => void;
  className?: string;
};

export function LeafletMap({ point, label, onPick, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  // Latest values for the async setup and the click handler, without
  // rebuilding the map every time they change.
  const latest = useRef({ point, onPick });
  useEffect(() => {
    latest.current = { point, onPick };
  });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((module) => {
      const L = (module.default ?? module) as typeof Leaflet;
      if (cancelled || !box.current) return;
      const picking = Boolean(latest.current.onPick);
      const instance = L.map(box.current, {
        scrollWheelZoom: false, // don't hijack page scrolling
        // On phones a one-finger drag should scroll the page, not the map
        // (pinch still zooms). The admin picker needs dragging everywhere.
        dragging: picking || !L.Browser.mobile,
        zoomControl: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance);
      instance.on("click", (event: Leaflet.LeafletMouseEvent) => {
        latest.current.onPick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      leaflet.current = L;
      map.current = instance;
      placePin(L, instance, marker, latest.current.point);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  // Move the pin when the point changes.
  const lat = point?.lat;
  const lng = point?.lng;
  useEffect(() => {
    if (leaflet.current && map.current) {
      placePin(leaflet.current, map.current, marker, lat === undefined || lng === undefined ? null : { lat, lng });
    }
  }, [lat, lng]);

  return (
    <div
      ref={box}
      role="region"
      aria-label={label}
      className={cn(
        "relative z-0 h-64 w-full overflow-hidden rounded-[var(--radius-tile)] bg-line ring-2 ring-line sm:h-80",
        onPick && "cursor-crosshair",
        className,
      )}
    />
  );
}

/** Put the pin at `next` (or remove it) and centre the map on it. */
function placePin(L: typeof Leaflet, instance: Leaflet.Map, marker: { current: Leaflet.Marker | null }, next: LatLng | null) {
  if (!next) {
    marker.current?.remove();
    marker.current = null;
    instance.setView(PHILIPPINES, 5);
    return;
  }
  const at: [number, number] = [next.lat, next.lng];
  if (marker.current) {
    marker.current.setLatLng(at);
  } else {
    marker.current = L.marker(at, {
      icon: L.divIcon({ html: PIN_SVG, className: "", iconSize: [34, 44], iconAnchor: [17, 43] }),
      // Not a button: the text address and links beside the map are the
      // accessible way to use it.
      interactive: false,
      keyboard: false,
    }).addTo(instance);
  }
  // Keep the owner's zoom while they fine-tune the pin; otherwise zoom in.
  instance.setView(at, Math.max(instance.getZoom() || 0, 17));
}
