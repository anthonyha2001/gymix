import { createAdminClient } from "@/lib/supabase/admin";
import { runDirectDevices } from "@/lib/access/server";

// Daily (vercel.json): bring every door device up to date with the new day
// (memberships that ended, invoices that fell overdue) and send the changes to
// Hikvision devices Gymix reaches directly. ZKTeco devices and the bridge also
// do this on their own the first time they call in each day.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = createAdminClient();
  const { data: devices, error } = await db.from("access_devices").select("id").eq("is_active", true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let queued = 0;
  for (const d of devices ?? []) {
    const { data } = await db.rpc("access_sync_device", { p_device_id: d.id });
    queued += data ?? 0;
  }
  const direct = await runDirectDevices();
  return Response.json({
    devices: devices?.length ?? 0,
    queued,
    sent: direct.reduce((n, r) => n + r.sent, 0),
    failed: direct.reduce((n, r) => n + r.failed, 0),
  });
}
