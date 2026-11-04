"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { errorMessage, money, text, type ActionState } from "@/lib/action-result";
import { COACH_ROLES } from "@/lib/roles";
import { withParam } from "@/lib/url";

const PROGRAMS = "/dashboard/programs?tab=programs";

// Starts a program for a member (from their request and/or a template), then
// opens it in the builder dialog on the page the coach is on (returnPath).
export async function createMemberProgram(
  memberId: string | null,
  requestId: string | null,
  returnPath: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(COACH_ROLES);
  const member = memberId ?? text(formData, "member_id");
  if (!member) return { error: "Choose the member this program is for." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_member_program", {
    p_member_id: member,
    p_name: text(formData, "name") || "Training program",
    p_request_id: requestId ?? undefined,
    p_template_id: text(formData, "template_id") || undefined,
  });
  if (error || !data) return { error: errorMessage(error ?? { message: "" }, "Couldn't create the program.") };
  redirect(withParam(returnPath, "program", data));
}

export async function createTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, membership } = await requireStaff(COACH_ROLES);
  const name = text(formData, "name");
  if (!name) return { error: "Name the template, e.g. “Beginner full body, 3 days”." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .insert({ gym_id: membership.gymId, name, kind: "template", is_active: true, created_by: viewer.id })
    .select("id")
    .single();
  if (error) return { error: errorMessage(error, "Couldn't create the template.") };
  await supabase.from("program_days").insert({ program_id: data.id, position: 1, name: "Day 1" });
  redirect(withParam(PROGRAMS, "program", data.id));
}

export async function publishProgram(programId: string): Promise<ActionState> {
  await requireStaff(COACH_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_program", { p_program_id: programId });
  if (error) return { error: errorMessage(error, "Couldn't send the program.") };
  refresh();
  return { success: "Sent! The member can see it in their portal now." };
}

export async function saveAsTemplate(programId: string, name: string): Promise<ActionState> {
  await requireStaff(COACH_ROLES);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_as_template", { p_program_id: programId, p_name: name });
  if (error || !data) return { error: errorMessage(error ?? { message: "" }, "Couldn't save the template.") };
  redirect(withParam(PROGRAMS, "program", data));
}

export async function cancelRequest(requestId: string): Promise<ActionState> {
  await requireStaff(COACH_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_program_request", { p_request_id: requestId });
  if (error) return { error: errorMessage(error, "Couldn't close the request.") };
  refresh();
  return { success: "Request closed." };
}

export async function setProgramPrice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const price = money(formData, "program_price_usd");
  if (!Number.isFinite(price) || price < 0) return { error: "Enter a price, or 0 for free." };
  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ program_price_usd: price }).eq("id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: price > 0 ? "Saved. Members get an invoice when they request a program." : "Saved. Programs are free." };
}
