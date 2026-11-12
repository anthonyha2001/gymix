"use server";

import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/origin";

// A share link (and its QR code) for one of my programs.
export async function shareProgram(programId: string): Promise<{ url?: string; svg?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("share_program", { p_program_id: programId });
  if (error || !data) return { error: error?.message ?? "Couldn't share this program." };
  const url = `${await requestOrigin()}/p/${data}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0d1117", light: "#ffffff" } });
  return { url, svg };
}

// Adds a shared program to my programs, then opens it.
export async function addSharedProgram(token: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_shared_program", { p_token: token });
  if (error || !data) return { error: error?.message ?? "Couldn't add this program." };
  redirect(`/portal/programs?tab=programs&program=${data}&added=1`);
}
