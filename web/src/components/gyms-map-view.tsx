"use client";

import dynamic from "next/dynamic";
import type { MapPin } from "@/components/gym-map";

// Client wrapper so server pages can show the map (Leaflet runs in the browser only).
const GymMap = dynamic(() => import("@/components/gym-map").then((m) => m.GymMap), {
  ssr: false,
  loading: () => <div className="skeleton h-[32rem] rounded-2xl bg-canvas" />,
});

export function GymsMapView({ pins }: { pins: MapPin[] }) {
  return <GymMap pins={pins} className="h-[32rem]" />;
}
