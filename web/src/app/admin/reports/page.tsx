import { redirect } from "next/navigation";

// Reports was split into Revenue, Sign-ins, Lab and Settings on the rail.
export default function ReportsPage() {
  redirect("/admin/revenue");
}
