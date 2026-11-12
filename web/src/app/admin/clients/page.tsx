import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { getPricing } from "@/lib/pricing-server";
import { hoursAgoIso, todayIn } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientsBoard, type ClientRow, type RequestRow } from "./board";

export const metadata: Metadata = { title: "Clients" };

// From "can I have Gymix?" to a live gym: requests come in from /request,
// payment details go out on WhatsApp, the payment is confirmed here, and the
// login goes out on WhatsApp.
export default function ClientsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] bg-white/5" />}>
      <Clients />
    </Suspense>
  );
}

async function Clients() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: requests }, { data: overview }, { data: gyms }, { data: settings }, pricing, { data: payments }] = await Promise.all([
    supabase.from("access_requests").select("*").neq("status", "declined").order("created_at", { ascending: false }).limit(300),
    supabase.rpc("admin_gym_overview"),
    admin.from("gyms").select("id, is_lab, welcome_sent_at"),
    admin.from("platform_settings").select("payment_instructions, whatsapp").maybeSingle(),
    getPricing(),
    admin.from("platform_payments").select("amount_usd, created_at").gte("created_at", hoursAgoIso(24 * 30)),
  ]);
  const meta = new Map((gyms ?? []).map((g) => [g.id, g]));
  const today = todayIn("Asia/Beirut");
  const clients: ClientRow[] = (overview ?? [])
    .filter((g) => !meta.get(g.gym_id)?.is_lab)
    .map((g) => ({
      id: g.gym_id,
      name: g.name,
      owner: g.owner_name,
      email: g.owner_email,
      phone: g.owner_phone,
      createdAt: g.created_at,
      paidUntil: g.paid_until,
      trialEndsAt: g.trial_ends_at,
      status: g.suspended_at ? "suspended" : g.paid_until && g.paid_until >= today ? "paid" : g.trial_ends_at && g.trial_ends_at >= today ? "trial" : "expired",
      members: g.members,
      welcomeSentAt: meta.get(g.gym_id)?.welcome_sent_at ?? null,
    }));

  return (
    <ClientsBoard
      requests={(requests ?? []) as RequestRow[]}
      clients={clients}
      priceUsd={pricing.priceUsd}
      instructions={settings?.payment_instructions ?? ""}
      revenue30d={(payments ?? []).reduce((n, p) => n + Number(p.amount_usd), 0)}
    />
  );
}
