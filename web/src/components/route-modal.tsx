"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Modal } from "@/components/dialog";

// A dialog driven by the URL (e.g. ?plan=<id>), so its content can be loaded on
// the server while the page underneath stays put. Closing removes `param`
// from the URL without scrolling or leaving the page.
export function RouteModal({
  param,
  title,
  description,
  size = "lg",
  sheet = false,
  children,
}: {
  param: string | string[];
  title: string;
  description?: string;
  size?: "md" | "lg" | "xl";
  sheet?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    for (const p of Array.isArray(param) ? param : [param]) next.delete(p);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Modal open onClose={close} title={title} description={description} size={size} sheet={sheet}>
      {children}
    </Modal>
  );
}
