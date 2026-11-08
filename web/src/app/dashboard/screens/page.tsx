import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, Monitor, Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { RowMenu } from "@/components/row-menu";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton, buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { hasFeature } from "@/lib/features";
import { mediaUrl } from "@/lib/exercises";
import { requestOrigin } from "@/lib/origin";
import { MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { CopyField } from "../access/forms";
import { ago, isRecent } from "../access/shared";
import { createScreen, createSlide, deleteScreen, deleteSlide, moveSlide, setScreenActive, setSlideActive, updateScreen, updateSlide } from "./actions";
import { ScreenForm, SlideForm } from "./forms";
import { SLIDE_KINDS } from "./kinds";

export const metadata: Metadata = { title: "Screens" };

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ScreensPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <ScreensContent />
      </Suspense>
    </div>
  );
}

async function ScreensContent() {
  const { membership } = await requireStaff(MANAGER_ROLES);
  if (!(await hasFeature(membership.gymId, "screens"))) redirect("/dashboard");
  const supabase = await createClient();
  const [{ data: screens }, { data: slides }] = await Promise.all([
    supabase.from("screens").select("*").eq("gym_id", membership.gymId).order("created_at"),
    supabase.from("screen_slides").select("*").eq("gym_id", membership.gymId).order("position").order("created_at"),
  ]);
  const origin = await requestOrigin();
  const screenList = (screens ?? []).map((s) => ({ id: s.id, name: s.name }));
  const screenName = new Map(screenList.map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader
        title="Screens"
        description="TVs at the gym with today's classes, leaderboards, records, how busy it is, and your own news and offers."
        action={
          <Dialog label="Add screen" icon={<Plus className="size-4" />} title="Add a screen" description="Any TV or tablet with a web browser.">
            <ScreenForm action={createScreen} submitLabel="Add screen" />
          </Dialog>
        }
      />

      {!screens?.length ? (
        <Card className="px-6 py-12 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink text-brand">
            <Monitor className="size-6" />
          </span>
          <p className="mt-4 font-semibold">No screens yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Add a screen, then open its link full screen on the TV: a smart TV&apos;s browser, a Fire TV or Android TV stick, or a tablet on the wall.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {screens.map((s) => {
            const url = `${origin}/screen/${s.token}`;
            const online = s.is_active && isRecent(s.last_seen_at, 3 * 60_000);
            return (
              <Card key={s.id} className="overflow-hidden">
                <div className={`relative bg-ink ${s.orientation === "portrait" ? "mx-auto aspect-[9/16] max-h-80" : "aspect-video"}`}>
                  {s.is_active ? (
                    <iframe src={`/screen/${s.token}`} title={`Preview of ${s.name}`} className="pointer-events-none absolute top-0 left-0 h-[400%] w-[400%] origin-top-left scale-25 border-0" tabIndex={-1} />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-white/60">Switched off</div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold">
                        {s.name}
                        <Badge tone={!s.is_active ? "gray" : online ? "green" : "amber"}>{!s.is_active ? "Off" : online ? "On air" : "Not open anywhere"}</Badge>
                      </p>
                      <p className="text-xs text-muted">{s.last_seen_at ? `Last showing ${ago(s.last_seen_at)}` : "Open the link on the TV to start"}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={url} target="_blank" rel="noreferrer" className={buttonClass("secondary", "h-9 px-3")} aria-label={`Open ${s.name}`} title="Open">
                        <ExternalLink className="size-4" />
                      </a>
                      <RowMenu
                        label={`Actions for ${s.name}`}
                        items={[
                          { kind: "dialog", label: "Edit", title: `Edit ${s.name}`, content: <ScreenForm action={updateScreen.bind(null, s.id)} initial={s} submitLabel="Save" /> },
                          { kind: "action", label: s.is_active ? "Switch off" : "Switch on", action: setScreenActive.bind(null, s.id, !s.is_active) },
                          { kind: "action", label: "Remove", danger: true, action: deleteScreen.bind(null, s.id), confirm: `Remove ${s.name}? Its link stops working.` },
                        ]}
                      />
                    </div>
                  </div>
                  <CopyField label={`Link for ${s.name}`} value={url} secret />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <SectionTitle
          action={
            <Dialog label="Add slide" icon={<Plus className="size-4" />} variant="secondary" triggerClassName="h-9" title="Add a slide" size="lg">
              <SlideForm action={createSlide} screens={screenList} submitLabel="Add slide" />
            </Dialog>
          }
        >
          Slides
        </SectionTitle>
        {!slides?.length ? (
          <EmptyState>No slides yet. A good start: Classes today, Right now, the Leaderboard, and an announcement with your opening hours.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {slides.map((sl, i) => {
              const kind = SLIDE_KINDS.find((k) => k.value === sl.kind);
              const when = [
                sl.starts_on && `from ${formatDate(sl.starts_on)}`,
                sl.ends_on && `until ${formatDate(sl.ends_on)}`,
                sl.weekdays?.length && sl.weekdays.map((d) => DAY[d]).join(", "),
                sl.time_from && sl.time_to && `${sl.time_from.slice(0, 5)}–${sl.time_to.slice(0, 5)}`,
              ].filter(Boolean);
              const where = sl.screen_ids?.length ? sl.screen_ids.map((id) => screenName.get(id)).filter(Boolean).join(", ") : "Every screen";
              return (
                <li key={sl.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 text-sm ${sl.is_active ? "" : "opacity-55"}`}>
                  <span className="flex flex-col">
                    <MoveButton action={moveSlide.bind(null, sl.id, "up")} disabled={i === 0} label="Move up" icon="up" />
                    <MoveButton action={moveSlide.bind(null, sl.id, "down")} disabled={i === slides.length - 1} label="Move down" icon="down" />
                  </span>
                  {sl.image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(sl.image_path)} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className={`grid size-12 shrink-0 place-items-center rounded-lg text-xs font-bold ${sl.theme === "lime" ? "bg-brand" : sl.theme === "light" ? "bg-canvas ring-1 ring-line" : "bg-ink text-brand"}`}>{sl.duration_seconds}s</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {sl.title || kind?.label}
                      {sl.title && <span className="ml-2 font-normal text-muted">{kind?.label}</span>}
                    </span>
                    <span className="block text-xs text-muted">
                      {where} · {sl.duration_seconds}s{when.length ? ` · ${when.join(" · ")}` : ""}
                    </span>
                  </span>
                  {!sl.is_active && <Badge tone="gray">Hidden</Badge>}
                  <RowMenu
                    label={`Actions for slide ${sl.title ?? kind?.label}`}
                    items={[
                      {
                        kind: "dialog",
                        label: "Edit",
                        title: "Edit slide",
                        size: "lg",
                        content: <SlideForm action={updateSlide.bind(null, sl.id)} screens={screenList} initial={{ ...sl, image_url: sl.image_path ? mediaUrl(sl.image_path) : null }} submitLabel="Save slide" />,
                      },
                      { kind: "action", label: sl.is_active ? "Hide" : "Show again", action: setSlideActive.bind(null, sl.id, !sl.is_active) },
                      { kind: "action", label: "Delete", danger: true, action: deleteSlide.bind(null, sl.id), confirm: "Delete this slide?" },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

function MoveButton({ action, disabled, label, icon }: { action: () => Promise<unknown>; disabled: boolean; label: string; icon: "up" | "down" }) {
  return (
    <form action={action as unknown as () => Promise<void>}>
      <button disabled={disabled} aria-label={label} title={label} className="grid size-6 place-items-center rounded text-muted hover:bg-canvas hover:text-ink disabled:opacity-25">
        {icon === "up" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
      </button>
    </form>
  );
}

