import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/session";

// Single post-login entry point: sends each user to the right part of the app.
export async function GET() {
  const viewer = await getViewer();
  redirect(viewer ? homePathFor(viewer) : "/login");
}
