"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUnreachable, UNREACHABLE_MESSAGE } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/session";

export type CreateGymState = { error?: string };

export async function createGym(_prev: CreateGymState, formData: FormData): Promise<CreateGymState> {
  await requireViewer();

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { error: "Gym name must be between 2 and 80 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_gym", { p_name: name });
  if (error) {
    return { error: isUnreachable(error) ? UNREACHABLE_MESSAGE : "Couldn't create the gym. Please try again." };
  }

  redirect("/dashboard");
}
