import type { Spot } from "@/app/door-actions";

// The phone's location, quickly: a recent or network-based fix is enough
// (the gym's radius allows for it), so this takes well under a second once
// the member has allowed location for the site.
export function locate(): Promise<Spot | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 6_000 },
    );
  });
}
