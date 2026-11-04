import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionStatus } from "@/lib/pricing";

export type Subscription = {
  status: SubscriptionStatus;
  endsOn: string;
  daysLeft: number;
  trialEndsAt: string;
  paidUntil: string | null;
};

// The gym's Gymix subscription, once per request.
export const gymSubscription = cache(async (gymId: string): Promise<Subscription | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("gym_subscription", { p_gym_id: gymId }).maybeSingle();
  if (!data) return null;
  return {
    status: data.status as SubscriptionStatus,
    endsOn: data.ends_on,
    daysLeft: data.days_left,
    trialEndsAt: data.trial_ends_at,
    paidUntil: data.paid_until,
  };
});

export async function platformSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("payment_instructions, whatsapp").maybeSingle();
  return { instructions: data?.payment_instructions ?? "", whatsapp: data?.whatsapp ?? "" };
}

// A WhatsApp link to Gymix, with a message naming the gym.
export function renewLink(whatsapp: string, gymName: string) {
  const number = whatsapp.replace(/[^0-9]/g, "");
  if (!number) return null;
  const text = `Hi Gymix, I want to pay the subscription for ${gymName}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
