import { requestOrigin } from "@/lib/origin";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// "Download for Windows": a .cmd that fetches the Gymix Bridge and starts it
// with this gym's address and token already filled in. Owners and managers only.
export async function GET() {
  const viewer = await getViewer();
  const gym = viewer?.memberships.find((m) => m.role === "owner" || m.role === "manager");
  if (!gym) return new Response("Not allowed", { status: 403 });
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("access_bridge_token", { p_gym_id: gym.gymId });
  if (error || !token) return new Response("Not allowed", { status: 403 });
  const origin = await requestOrigin();

  const cmd = [
    "@echo off",
    "title Gymix Bridge",
    `rem Gymix Bridge for ${gym.gymName.replace(/[%&|<>^"]/g, "")}. Keep this window open (or run it at startup).`,
    "cd /d %~dp0",
    "where node >nul 2>nul || (echo Node.js is needed: install the LTS version from https://nodejs.org and run this again. & pause & exit /b 1)",
    `curl -fsSL -o gymix-bridge.mjs "${origin}/downloads/gymix-bridge.mjs" || (echo Couldn't download the bridge. Check the internet connection. & pause & exit /b 1)`,
    `set GYMIX_URL=${origin}`,
    `set GYMIX_BRIDGE_TOKEN=${token}`,
    ":run",
    "node gymix-bridge.mjs",
    "echo The bridge stopped. Restarting in 10 seconds...",
    "timeout /t 10 >nul",
    "goto run",
    "",
  ].join("\r\n");

  return new Response(cmd, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="gymix-bridge.cmd"',
      "Cache-Control": "no-store",
    },
  });
}
