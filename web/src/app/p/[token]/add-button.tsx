"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { showToast } from "@/components/toaster";
import { haptics } from "@/lib/haptics";
import { addSharedProgram } from "@/app/share-actions";

export function AddSharedProgram({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        haptics.success();
        setPressed(true);
        start(async () => {
          const r = await addSharedProgram(token);
          if (r?.error) {
            setPressed(false);
            showToast(r.error, "error");
          }
        });
      }}
      className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-ink shadow-[0_14px_40px_-14px_rgb(200_241_53/0.8)] transition active:scale-[0.98] ${pressed ? "add-pressed" : ""}`}
    >
      {pending ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" strokeWidth={2.5} />}
      {pending ? "Adding…" : "Add to my programs"}
    </button>
  );
}
