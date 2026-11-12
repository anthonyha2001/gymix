"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Circle, LeafletMouseEvent, Map as LeafletMap, Marker } from "leaflet";

// A map of gyms (OpenStreetMap). Two uses:
//   * pick: one draggable pin (the owner's gym); tap the map to move it.
//     Optional `radius` draws the "phone must be at the gym" circle.
//   * view: many pins with names (the super admin's map of every Gymix gym).
// Pins are lime Gymix markers with a soft pulse; no image files needed.

export type MapPin = { id: string; lat: number; lng: number; name: string; detail?: string; tone?: "good" | "warn" | "bad" | "neutral" };

const BEIRUT: [number, number] = [33.8938, 35.5018];

function pinIcon(L: typeof import("leaflet"), tone: MapPin["tone"] = "good", big = false) {
  const color = { good: "#c8f135", warn: "#f59e0b", bad: "#ef4444", neutral: "#9ca3af" }[tone];
  const size = big ? 44 : 34;
  return L.divIcon({
    className: "gx-pin",
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, size + 6],
    popupAnchor: [0, -size],
    html: `<span class="gx-pin-pulse" style="--pin:${color}"></span><span class="gx-pin-body" style="--pin:${color};width:${size}px;height:${size}px"><svg viewBox="0 0 100 100" aria-hidden="true"><g transform="translate(14,10) scale(0.72)" fill="none" stroke="#0d1117" stroke-linejoin="round"><path d="M47.6 35.5 A27 23 0 1 0 69 58 H48" stroke-width="16"/><path d="M60.8 29.1 A13 13 0 0 1 71.9 40.2" stroke-width="8.5" stroke-linecap="round"/><path d="M62.3 18.2 A24 24 0 0 1 82.8 38.7" stroke-width="8.5" stroke-linecap="round"/></g></svg></span>`,
  });
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export function GymMap({
  pins = [],
  value,
  onPick,
  radius,
  className = "h-80",
}: {
  pins?: MapPin[];
  value?: { lat: number; lng: number } | null;
  onPick?: (spot: { lat: number; lng: number }) => void;
  radius?: number | null;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const lib = useRef<typeof import("leaflet") | null>(null);
  const picker = useRef<Marker | null>(null);
  const circle = useRef<Circle | null>(null);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !box.current || map.current) return;
      lib.current = L;
      const m = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.setView(value ? [value.lat, value.lng] : BEIRUT, value ? 17 : 12);
      // Scroll-zoom only after a tap on the map, so the page scrolls normally.
      m.on("click", () => m.scrollWheelZoom.enable());
      m.on("mouseout", () => m.scrollWheelZoom.disable());
      if (pick.current) {
        m.on("click", (e: LeafletMouseEvent) => pick.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      }
      map.current = m;
      // The box may have been sized after creation (tabs, dialogs).
      setTimeout(() => m.invalidateSize(), 150);
      draw();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      picker.current = null;
      circle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pins, the picked spot and the radius follow the props.
  function draw() {
    const L = lib.current;
    const m = map.current;
    if (!L || !m) return;

    if (onPick) {
      if (value) {
        if (!picker.current) {
          picker.current = L.marker([value.lat, value.lng], { draggable: true, icon: pinIcon(L, "good", true), autoPan: true }).addTo(m);
          picker.current.on("dragend", () => {
            const p = picker.current!.getLatLng();
            pick.current?.({ lat: p.lat, lng: p.lng });
          });
        } else picker.current.setLatLng([value.lat, value.lng]);
      } else if (picker.current) {
        picker.current.remove();
        picker.current = null;
      }
      if (value && radius) {
        if (!circle.current) {
          circle.current = L.circle([value.lat, value.lng], { radius, color: "#a9d10f", weight: 2, fillColor: "#c8f135", fillOpacity: 0.15 }).addTo(m);
        } else circle.current.setLatLng([value.lat, value.lng]).setRadius(radius);
      } else if (circle.current) {
        circle.current.remove();
        circle.current = null;
      }
      return;
    }

    // View mode: every pin, with its name.
    const layer = L.layerGroup().addTo(m);
    for (const p of pins) {
      L.marker([p.lat, p.lng], { icon: pinIcon(L, p.tone) })
        .bindPopup(`<strong>${escape(p.name)}</strong>${p.detail ? `<br><span style="color:#5d6470">${escape(p.detail)}</span>` : ""}`)
        .bindTooltip(escape(p.name), { direction: "top", offset: [0, -30], permanent: pins.length <= 25, className: "gx-pin-label" })
        .addTo(layer);
    }
    if (pins.length) m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])).pad(0.25), { maxZoom: 15 });
  }

  useEffect(() => {
    if (!onPick) return;
    draw();
    if (value && map.current) map.current.panTo([value.lat, value.lng], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, radius]);

  return <div ref={box} className={`gx-map relative z-0 overflow-hidden rounded-2xl border border-line bg-canvas ${className}`} />;
}
