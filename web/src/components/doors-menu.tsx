"use client";

import { useState } from "react";
import { DoorOpen } from "lucide-react";
import { Modal } from "@/components/dialog";
import { SlideToOpen } from "@/components/slide-to-open";

export type Door = { id: string; name: string; zone: string | null; online: boolean; active: boolean };

// The door icon next to the bell: every door of the gym with its own
// "Open door" button, from any page of the dashboard.
export function DoorsMenu({ doors }: { doors: Door[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open a door"
        title="Open a door"
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
      >
        <DoorOpen className="size-[18px]" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Open a door" description="Unlocks the door for a few seconds. Every opening is logged with your name.">
        <ul className="stagger space-y-4">
          {doors.map((d) => (
            <li key={d.id} className="space-y-2">
              <span className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{d.name}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                  <span aria-hidden className={`size-2 rounded-full ${!d.active ? "bg-line" : d.online ? "bg-success animate-pulse" : "bg-danger"}`} />
                  {!d.active ? "Paused" : d.online ? "Online" : "Offline"}
                  {d.zone ? ` · ${d.zone}` : ""}
                </span>
              </span>
              {d.active ? <SlideToOpen deviceId={d.id} name={d.name} /> : null}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
