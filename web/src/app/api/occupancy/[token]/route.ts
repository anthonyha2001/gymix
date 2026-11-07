import { createAdminClient } from "@/lib/supabase/admin";

// People counters post here (the token in the URL identifies the counter).
// Accepts:
//   {"people": 23}                      the number inside right now
//   {"in": 3, "out": 1}                 entries and exits since the last message
//   a Hikvision people-counting event   (its running enter/exit totals for the day)

type Ctx = { params: Promise<{ token: string }> };
const ok = (body = "OK", status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
// A whole, non-negative count; null if missing or not a valid count.
const int = (v: unknown) => {
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};
const given = (...vs: unknown[]) => vs.find((v) => v !== undefined);

function jsonFrom(body: string, contentType: string): Record<string, unknown> | null {
  const parse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  if (contentType.includes("multipart/")) {
    const boundary = contentType.match(/boundary="?([^";]+)"?/)?.[1];
    for (const part of boundary ? body.split(`--${boundary}`) : []) {
      const i = part.indexOf("{");
      if (i >= 0) {
        const obj = parse(part.slice(i, part.lastIndexOf("}") + 1));
        if (obj) return obj;
      }
    }
    return null;
  }
  return parse(body.trim());
}

export async function GET(_request: Request, { params }: Ctx) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) return ok("Unknown counter", 404);
  const { data } = await createAdminClient().from("occupancy_sensors").select("id").eq("token", token).maybeSingle();
  return data ? ok() : ok("Unknown counter", 404);
}

export async function POST(request: Request, { params }: Ctx) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) return ok("Unknown counter", 404);
  const body = await request.text();
  const obj = jsonFrom(body, request.headers.get("content-type") ?? "");
  if (!obj) return ok("Send JSON: {\"people\": 23} or {\"in\": 3, \"out\": 1}", 400);

  let entered = 0;
  let exited = 0;
  let people: number | null = null;
  const pc = (obj.PeopleCounting ?? obj.peopleCounting) as Record<string, unknown> | undefined;
  if (pc) {
    // Hikvision: running totals since the counter's daily reset.
    const rt = (pc.RealTime ?? pc.realTime ?? pc) as Record<string, unknown>;
    const enter = int(rt.enter);
    const exit = int(rt.exit);
    if (enter === null || exit === null) return ok("OK"); // other people-counting messages
    people = Math.max(0, enter - exit);
  } else {
    const rawPeople = given(obj.people, obj.count, obj.occupancy);
    const rawIn = given(obj.in, obj.entered, obj.enter);
    const rawOut = given(obj.out, obj.exited, obj.exit);
    if (rawPeople === undefined && rawIn === undefined && rawOut === undefined) {
      return ok("Send JSON: {\"people\": 23} or {\"in\": 3, \"out\": 1}", 400);
    }
    people = rawPeople === undefined ? null : int(rawPeople);
    entered = rawIn === undefined ? 0 : (int(rawIn) ?? -1);
    exited = rawOut === undefined ? 0 : (int(rawOut) ?? -1);
    if ((rawPeople !== undefined && people === null) || entered < 0 || exited < 0) {
      return ok("Counts must be whole numbers, 0 or more.", 400);
    }
  }

  const { data, error } = await createAdminClient().rpc("occupancy_ingest", {
    p_token: token,
    p_entered: Math.min(entered, 10000),
    p_exited: Math.min(exited, 10000),
    p_people: people === null ? undefined : Math.min(people, 10000),
  });
  if (error) return ok("Couldn't save the count", 500);
  return data ? ok() : ok("Unknown counter", 404);
}
