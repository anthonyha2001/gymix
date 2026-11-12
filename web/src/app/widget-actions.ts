"use server";

import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { requestOrigin } from "@/lib/origin";

// What the app gives its home-screen widget: where to ask, and the token.
export async function widgetConnection(renew = false) {
  const viewer = await getViewer();
  if (!viewer || !viewer.memberships.some((m) => m.role === "member")) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_widget_token", { p_new: renew });
  if (error || !data) return null;
  return { url: `${await requestOrigin()}/api/widget`, token: data };
}
