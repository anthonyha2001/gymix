"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";
import { connectWidget } from "@/lib/widget";
import { widgetConnection } from "@/app/widget-actions";

const KEY = "gymix:widget-linked";

// In the member app on a phone: gives the home-screen widget its token (once
// a day, and again if the account on the phone changes) so it can show the
// member's numbers.
export function WidgetLink({ userId }: { userId: string }) {
  useEffect(() => {
    if (!isNativeApp()) return;
    try {
      const last = JSON.parse(localStorage.getItem(KEY) ?? "null") as { user: string; at: number } | null;
      if (last && last.user === userId && Date.now() - last.at < 24 * 3600_000) return;
    } catch {}
    widgetConnection().then(async (c) => {
      if (!c) return;
      await connectWidget(c);
      try {
        localStorage.setItem(KEY, JSON.stringify({ user: userId, at: Date.now() }));
      } catch {}
    });
  }, [userId]);
  return null;
}
