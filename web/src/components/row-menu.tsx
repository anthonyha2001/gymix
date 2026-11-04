"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { Modal } from "@/components/dialog";
import { showToast } from "@/components/toaster";
import type { ActionState } from "@/lib/action-result";

export type RowMenuItem =
  | { kind: "link"; label: string; href: string }
  | {
      kind: "action";
      label: string;
      action: () => Promise<ActionState | void>;
      confirm?: string;
      danger?: boolean;
    }
  | {
      kind: "dialog";
      label: string;
      title: string;
      description?: string;
      size?: "md" | "lg" | "xl";
      content: ReactNode;
      danger?: boolean;
    };

const MENU_WIDTH = 224;

// "⋯" menu with the actions for one row: links, one-click actions (with a
// custom confirmation) and dialogs. The menu renders in a floating layer on
// <body>, so table/card overflow can never clip it.
export function RowMenu({ items, label = "Actions" }: { items: (RowMenuItem | false | null | undefined)[]; label?: string }) {
  const shown = items.filter(Boolean) as RowMenuItem[];
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [dialog, setDialog] = useState<Extract<RowMenuItem, { kind: "dialog" }> | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDialog, confirm] = useConfirm();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  function toggle() {
    if (open) return setPos(null);
    const r = button.current!.getBoundingClientRect();
    const estimatedHeight = shown.length * 40 + 8;
    const below = r.bottom + 4 + estimatedHeight < window.innerHeight;
    setPos({
      top: below ? r.bottom + 4 : Math.max(8, r.top - estimatedHeight - 4),
      left: Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    });
  }

  // Close on outside click, Escape, scroll or resize.
  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!shown.length) return null;

  async function run(item: Extract<RowMenuItem, { kind: "action" }>) {
    setPos(null);
    if (item.confirm && !(await confirm(item.confirm, { danger: item.danger ?? false, confirmLabel: item.label }))) return;
    startTransition(async () => {
      const result = await item.action();
      if (result?.error) showToast(result.error, "error");
      else if (result?.success) showToast(result.success);
    });
  }

  const itemClass = (danger?: boolean) =>
    `block w-full rounded-md px-3 py-2 text-left text-sm ${danger ? "text-danger hover:bg-danger-soft" : "hover:bg-canvas"}`;

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink disabled:opacity-50"
      >
        <MoreHorizontal className="size-5" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="z-50 rounded-xl border border-line bg-surface p-1 shadow-lg"
          >
            {shown.map((item) =>
              item.kind === "link" ? (
                <Link key={item.label} role="menuitem" href={item.href} onClick={() => setPos(null)} className={itemClass()}>
                  {item.label}
                </Link>
              ) : item.kind === "action" ? (
                <button key={item.label} role="menuitem" type="button" onClick={() => run(item)} className={itemClass(item.danger)}>
                  {item.label}
                </button>
              ) : (
                <button
                  key={item.label}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setPos(null);
                    setDialog(item);
                  }}
                  className={itemClass(item.danger)}
                >
                  {item.label}…
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
      {dialog && (
        <Modal open onClose={() => setDialog(null)} title={dialog.title} description={dialog.description} size={dialog.size}>
          {dialog.content}
        </Modal>
      )}
      {confirmDialog}
    </>
  );
}
