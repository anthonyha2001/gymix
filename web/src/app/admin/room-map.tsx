"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";

// The control room's dark world map. Points are lime dots sized by count;
// `live` ones pulse. Tooltips name each one. Fits itself around the points.
export type RoomPoint = { lat: number; lng: number; label: string; detail?: string; weight?: number; live?: boolean; tone?: "lime" | "good" | "warn" | "bad" };

const TONES = { lime: "#c8f135", good: "#34d399", warn: "#fbbf24", bad: "#fb7185" };

export function RoomMap({ points, className = "h-80", zoom = 2 }: { points: RoomPoint[]; className?: string; zoom?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lib = await import("leaflet");
      if (cancelled || !box.current || map.current) return;
      L.current = lib;
      const m = lib.map(box.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, worldCopyJump: true }).setView([30, 25], zoom);
      // OpenStreetMap's free tiles, turned dark in CSS (.room-map .leaflet-tile-pane).
      lib.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      lib.control.zoom({ position: "bottomright" }).addTo(m);
      m.on("click", () => m.scrollWheelZoom.enable());
      m.on("mouseout", () => m.scrollWheelZoom.disable());
      layer.current = lib.layerGroup().addTo(m);
      map.current = m;
      setTimeout(() => m.invalidateSize(), 150);
      draw();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const lib = L.current;
    const m = map.current;
    const g = layer.current;
    if (!lib || !m || !g) return;
    g.clearLayers();
    const max = Math.max(1, ...points.map((p) => p.weight ?? 1));
    for (const p of points) {
      const size = 10 + Math.round(((p.weight ?? 1) / max) * 18);
      const color = TONES[p.tone ?? "lime"];
      const icon = lib.divIcon({
        className: "room-dot",
        iconSize: [size, size],
        html: `${p.live ? `<span class="room-dot-pulse" style="--c:${color}"></span>` : ""}<span class="room-dot-core" style="--c:${color}"></span>`,
      });
      const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
      lib
        .marker([p.lat, p.lng], { icon, keyboard: false })
        .bindTooltip(`<b>${esc(p.label)}</b>${p.detail ? `<br>${esc(p.detail)}` : ""}`, { direction: "top", offset: [0, -size / 2], className: "room-tip" })
        .addTo(g);
    }
    if (points.length && !fitted.current) {
      fitted.current = true;
      const b = lib.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      m.fitBounds(b.pad(0.6), { maxZoom: 6 });
    }
  }

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  return <div ref={box} className={`room-map relative z-0 overflow-hidden rounded-3xl bg-[#0b0f15] ring-1 ring-white/[0.07] ${className}`} />;
}
