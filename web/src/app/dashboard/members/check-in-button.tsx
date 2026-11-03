"use client";

import { useActionState } from "react";
import { ScanLine } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { checkIn, type CheckInResult } from "./actions";

export function CheckInButton({ memberId }: { memberId: string }) {
  const [result, action, pending] = useActionState<CheckInResult | null>(() => checkIn({ memberId }), null);

  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        <ScanLine className="size-4" />
        {pending ? "Checking in…" : "Check in"}
      </button>
      {result && (
        <span role="status" className={`text-xs ${result.allowed ? "text-success" : "text-danger"}`}>
          {result.error ??
            (result.allowed ? (result.alreadyIn ? "Already checked in." : "Checked in ✓") : `Denied: ${result.reason}`)}
        </span>
      )}
    </form>
  );
}
