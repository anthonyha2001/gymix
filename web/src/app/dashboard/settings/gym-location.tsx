"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import { Alert, Button, Field, buttonClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

// The map only loads in the browser (Leaflet needs the page).
const GymMap = dynamic(() => import("@/components/gym-map").then((m) => m.GymMap), {
  ssr: false,
  loading: () => <div className="skeleton h-80 rounded-2xl bg-canvas" />,
});

type Spot = { lat: number; lng: number };
type Found = { lat: string; lon: string; display_name: string };

// Where the gym is: search an address, use this phone's location, or tap the
// map and drag the pin. Used for the Gymix map, "phone must be at the gym"
// and the live count.
export function GymLocation({
  action,
  initial,
  doorRadius,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial: { lat: number; lng: number; address: string | null } | null;
  doorRadius: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [spot, setSpot] = useState<Spot | null>(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [address, setAddress] = useState(initial?.address ?? "");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [busy, setBusy] = useState<"search" | "locate" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function search() {
    if (query.trim().length < 3) return;
    setBusy("search");
    setProblem(null);
    try {
      // OpenStreetMap's free address search (one search per press).
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=en&q=${encodeURIComponent(query.trim())}`,
      );
      const list = (await res.json()) as Found[];
      setFound(list);
      if (!list.length) setProblem("Nothing found. Try the street and city, or tap the map.");
    } catch {
      setProblem("Search isn't available right now. Tap the map instead.");
    }
    setBusy(null);
  }

  function locate() {
    if (!("geolocation" in navigator)) return setProblem("This browser can't share its location.");
    setBusy("locate");
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(null);
        setSpot({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {
        setBusy(null);
        setProblem("Couldn't get the location. Allow location for this site, or tap the map.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {problem && <Alert tone="error">{problem}</Alert>}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            placeholder="Search an address: Hamra Street, Beirut"
            aria-label="Search an address"
            className={`${inputClass} pl-9`}
          />
        </div>
        <button type="button" onClick={search} disabled={busy !== null} className={buttonClass("secondary")}>
          {busy === "search" ? <Loader2 className="size-4 animate-spin" /> : "Search"}
        </button>
        <button type="button" onClick={locate} disabled={busy !== null} className={buttonClass("secondary")}>
          {busy === "locate" ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
          I&apos;m at the gym
        </button>
      </div>

      {found.length > 0 && (
        <ul className="page-enter divide-y divide-line overflow-hidden rounded-xl border border-line">
          {found.map((f) => (
            <li key={`${f.lat},${f.lon}`}>
              <button
                type="button"
                onClick={() => {
                  setSpot({ lat: Number(f.lat), lng: Number(f.lon) });
                  setAddress(f.display_name.split(",").slice(0, 3).join(",").trim());
                  setFound([]);
                }}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-canvas"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
                <span className="line-clamp-2">{f.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <GymMap value={spot} onPick={setSpot} radius={doorRadius} className="h-80" />
      <p className="text-xs text-muted">
        {spot ? "Drag the pin, or tap the map, to put it exactly on your entrance." : "Tap the map where your gym is."}
        {doorRadius ? ` The circle is the ${doorRadius} m within which door stickers open.` : ""}
      </p>

      <input type="hidden" name="lat" value={spot?.lat ?? ""} />
      <input type="hidden" name="lng" value={spot?.lng ?? ""} />
      <Field label="Address (optional)">
        <input name="address" maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Building, street, area" className={inputClass} />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        {initial && (
          <button type="submit" name="clear" value="1" disabled={pending} className={buttonClass("ghost")}>
            Remove location
          </button>
        )}
        <Button disabled={pending || !spot}>{pending ? "Saving…" : "Save location"}</Button>
      </div>
    </form>
  );
}
