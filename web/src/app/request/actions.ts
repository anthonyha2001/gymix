"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// A gym asks for Gymix. Lands in the control room's Clients.
export async function submitRequest(fd: FormData): Promise<{ error?: string; ok?: true }> {
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const owner = get("owner_name");
  const phone = get("phone");
  const email = get("email");
  const gym = get("gym_name");
  if (owner.length < 2 || gym.length < 2) return { error: "Write your name and your gym's name." };
  if (phone.replace(/\D/g, "").length < 7) return { error: "Write a WhatsApp number we can reach." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Write a valid email." };
  // Where they came from (the site tracker's visit), for the marketing view.
  const raw = (await cookies()).get("gx_src")?.value ?? null;
  let source = raw;
  try {
    source = raw ? decodeURIComponent(raw) : null;
  } catch {}
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_access_request", {
    p_owner_name: owner,
    p_phone: phone,
    p_email: email,
    p_gym_name: gym,
    p_city: get("city") || undefined,
    p_members: ["<50", "50-150", "150-400", "400+"].includes(get("members")) ? get("members") : undefined,
    p_message: get("message") || undefined,
    p_source: source ?? undefined,
  });
  if (error) return { error: error.message.startsWith("We already") ? error.message : "Couldn't send. Try again, or message us on WhatsApp." };
  return { ok: true };
}
