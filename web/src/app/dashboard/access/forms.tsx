"use client";

import { useActionState, useState } from "react";
import { Check, Copy, MapPin } from "lucide-react";
import { useDialogAction } from "@/components/dialog";
import { ChoiceChips } from "@/components/form-controls";
import { Alert, Button, Field, buttonClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export type DeviceValues = {
  vendor: "zkteco" | "hikvision";
  name: string;
  zone_id: string | null;
  direction: "in" | "out" | "both";
  serial_number: string | null;
  connection: "push" | "direct" | "bridge";
  host: string | null;
  username: string;
  door_no: number;
};

const DIRECTION_OPTIONS = [
  { value: "in", label: "Entrance" },
  { value: "out", label: "Exit" },
  { value: "both", label: "Both ways" },
];

export function DeviceForm({ action, zones, initial, submitLabel }: { action: Action; zones: { id: string; name: string }[]; initial?: DeviceValues; submitLabel: string }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [vendor, setVendor] = useState<"zkteco" | "hikvision">(initial?.vendor ?? "zkteco");
  const [connection, setConnection] = useState(initial?.connection === "direct" ? "direct" : "bridge");
  const [direction, setDirection] = useState<string>(initial?.direction ?? "in");
  const editing = Boolean(initial);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      {editing ? (
        <input type="hidden" name="vendor" value={vendor} />
      ) : (
        <Field label="Brand" group>
          <ChoiceChips
            name="vendor"
            label="Brand"
            value={vendor}
            onChange={(v) => setVendor(v as "zkteco" | "hikvision")}
            columns={2}
            size="lg"
            options={[
              { value: "zkteco", label: "ZKTeco" },
              { value: "hikvision", label: "Hikvision" },
            ]}
          />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" required maxLength={60} defaultValue={initial?.name} placeholder="e.g. Main entrance" className={inputClass} autoFocus={!editing} />
        </Field>
        <Field label="Zone" optional hint="Plans can be limited to zones.">
          <select name="zone_id" defaultValue={initial?.zone_id ?? ""} className={inputClass}>
            <option value="">No zone (every plan)</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="This reader is the" group hint="Exits let Gymix count who's inside right now.">
        <ChoiceChips name="direction" label="Direction" value={direction} onChange={setDirection} options={DIRECTION_OPTIONS} />
      </Field>

      {vendor === "zkteco" ? (
        <Field label="Serial number" hint="On the device: Menu → System Info → Device Info. Also on the sticker underneath.">
          <input
            name="serial_number"
            required
            defaultValue={initial?.serial_number ?? ""}
            placeholder="e.g. CKPK214460021"
            autoCapitalize="characters"
            spellCheck={false}
            className={`${inputClass} font-mono uppercase`}
          />
        </Field>
      ) : (
        <>
          {editing ? (
            <input type="hidden" name="connection" value={connection} />
          ) : (
            <Field label="How Gymix reaches it" group>
              <ChoiceChips
                name="connection"
                label="Connection"
                value={connection}
                onChange={setConnection}
                columns={2}
                options={[
                  { value: "bridge", label: "Gymix Bridge (recommended)" },
                  { value: "direct", label: "Directly over the internet" },
                ]}
              />
            </Field>
          )}
          <p className="-mt-2 text-xs text-muted">
            {connection === "bridge"
              ? "A small program on a computer at the gym talks to the device on your network. Nothing to change on your router."
              : "The device must be reachable from the internet (a fixed address with port forwarding)."}
          </p>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label={connection === "bridge" ? "Address on the gym network" : "Internet address"}>
              <input
                name="host"
                required
                defaultValue={initial?.host?.replace(/^http:\/\//, "") ?? ""}
                placeholder={connection === "bridge" ? "192.168.1.64" : "41.23.10.5:8080"}
                spellCheck={false}
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field label="Door">
              <input name="door_no" type="number" min={1} max={8} defaultValue={initial?.door_no ?? 1} className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Device username">
              <input name="username" defaultValue={initial?.username ?? "admin"} autoComplete="off" spellCheck={false} className={inputClass} />
            </Field>
            <Field label="Device password" hint={editing ? "Leave empty to keep the current one." : "The one you set when activating the device."}>
              <input name="password" type="password" autoComplete="new-password" required={!editing} className={inputClass} />
            </Field>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

export function NameForm({ action, initial, submitLabel, placeholder }: { action: Action; initial?: string; submitLabel: string; placeholder?: string }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Name">
        <input name="name" required maxLength={60} defaultValue={initial} placeholder={placeholder} className={inputClass} autoFocus />
      </Field>
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

// The zones one plan opens: tick none and it opens every door.
export function PlanZonesForm({ action, zones, selected }: { action: Action; zones: { id: string; name: string }[]; selected: string[] }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [picked, setPicked] = useState(new Set(selected));
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {zones.map((z) => {
        const on = picked.has(z.id);
        return (
          <label key={z.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 transition ${on ? "bg-ink text-white ring-ink" : "bg-surface ring-line hover:bg-canvas"}`}>
            <input
              type="checkbox"
              name="zone"
              value={z.id}
              checked={on}
              onChange={() => setPicked((p) => {
                const n = new Set(p);
                if (n.has(z.id)) n.delete(z.id);
                else n.add(z.id);
                return n;
              })}
              className="sr-only"
            />
            {z.name}
          </label>
        );
      })}
      <Button variant="secondary" className="h-9" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error && <span className="text-sm text-danger">{state.error}</span>}
      {state.success && <span className="text-sm text-success">{state.success}</span>}
    </form>
  );
}

// A value to copy (an address, a token). Secrets stay hidden until shown.
export function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        aria-label={label}
        value={shown ? value : "•".repeat(Math.min(value.length, 40))}
        onFocus={(e) => shown && e.target.select()}
        className={`${inputClass} font-mono text-xs`}
      />
      {secret && (
        <button type="button" onClick={() => setShown((s) => !s)} className={buttonClass("secondary", "shrink-0")}>
          {shown ? "Hide" : "Show"}
        </button>
      )}
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className={buttonClass("secondary", "shrink-0")}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function CardForm({ action, initial }: { action: Action; initial: string | null }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Card number" optional hint="Digits as printed on the card, or tap the card on a device's enrolment screen and Gymix fills it in.">
        <input name="card" inputMode="numeric" defaultValue={initial ?? ""} placeholder="e.g. 4455667" className={`${inputClass} font-mono`} autoFocus />
      </Field>
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving…" : "Save card"}</Button>
      </div>
    </form>
  );
}

// "Phone must be at the gym": the owner stands at the gym and saves its
// location; door sticker taps then only open within the chosen distance.
export function DoorLocationForm({ action, current }: { action: Action; current: { lat: number; lng: number; radius: number | null } | null }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [spot, setSpot] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(
    current ? { lat: current.lat, lng: current.lng, accuracy: null } : null,
  );
  const [finding, setFinding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function findMe() {
    if (!("geolocation" in navigator)) return setProblem("This browser can't share its location.");
    setFinding(true);
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setFinding(false);
        setSpot({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) });
      },
      () => {
        setFinding(false);
        setProblem("Couldn't get the location. Allow location for this site and try again, at the gym.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {problem && <Alert tone="error">{problem}</Alert>}
      <input type="hidden" name="lat" value={spot?.lat ?? ""} />
      <input type="hidden" name="lng" value={spot?.lng ?? ""} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={findMe} disabled={finding} className={buttonClass("secondary")}>
          <MapPin className="size-4" />
          {finding ? "Finding you…" : spot ? "Use this phone's location again" : "Use this phone's location"}
        </button>
        {spot && (
          <span className="text-sm text-muted">
            {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
            {spot.accuracy !== null ? ` (±${spot.accuracy} m)` : ""}
          </span>
        )}
      </div>
      <Field label="Opens within" group>
        <ChoiceChips
          name="radius"
          label="Opens within"
          defaultValue={String(current?.radius ?? 150)}
          options={[
            { value: "100", label: "100 m" },
            { value: "150", label: "150 m", hint: "Recommended" },
            { value: "300", label: "300 m" },
            { value: "500", label: "500 m" },
          ]}
        />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        {current?.radius != null && (
          <button type="submit" name="off" value="1" disabled={pending} className={buttonClass("ghost")}>
            Turn off
          </button>
        )}
        <Button disabled={pending || !spot}>{pending ? "Saving…" : current?.radius != null ? "Save" : "Turn on"}</Button>
      </div>
    </form>
  );
}
