"use client";

import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { inputClass } from "@/components/ui";

type Option = { value: string; label: string; disabled: boolean };
type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode };

function text(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return text(node.props.children);
  return "";
}

function readOptions(children: ReactNode): Option[] {
  const out: Option[] = [];
  Children.forEach(children, (child) => {
    if (Array.isArray(child)) out.push(...readOptions(child));
    else if (isValidElement(child) && child.type === "option") {
      const p = (child as ReactElement<OptionProps>).props;
      out.push({ value: String(p.value ?? ""), label: text(p.children).trim(), disabled: Boolean(p.disabled) });
    }
  });
  return out;
}

// A drop-in for <select> with a search box: same <option> children, name,
// value/defaultValue, onChange and required. The list opens in the top layer
// (a popover), so it shows above dialogs and is never clipped.
export function SearchSelect({
  name,
  value: controlled,
  defaultValue,
  onChange,
  required,
  className = inputClass,
  children,
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  required?: boolean;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const options = useMemo(() => readOptions(children), [children]);
  const [own, setOwn] = useState(String(defaultValue ?? ""));
  const value = controlled !== undefined ? String(controlled) : own;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const placeholder = options.find((o) => o.value === "" && o.disabled)?.label ?? "Choose…";
  const shown = options.filter((o) => !(o.value === "" && o.disabled) && o.label.toLowerCase().includes(query.trim().toLowerCase()));

  function place() {
    const el = panel.current;
    const r = button.current?.getBoundingClientRect();
    if (!el || !r) return;
    const below = window.innerHeight - r.bottom;
    const height = Math.min(320, el.scrollHeight);
    el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 240) - 8))}px`;
    el.style.width = `${Math.max(r.width, 240)}px`;
    el.style.top = below < height + 12 && r.top > below ? `${Math.max(8, r.top - height - 4)}px` : `${r.bottom + 4}px`;
  }

  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (open) {
      if (!el.matches(":popover-open")) el.showPopover();
      place();
      search.current?.focus();
    } else if (el.matches(":popover-open")) {
      el.hidePopover();
    }
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    const reposition = () => place();
    document.addEventListener("mousedown", outside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  function choose(o: Option) {
    if (o.disabled) return;
    if (controlled === undefined) setOwn(o.value);
    onChange?.({ target: { value: o.value } });
    setOpen(false);
    button.current?.focus();
  }

  function openList() {
    setQuery("");
    setActive(Math.max(0, options.filter((o) => !(o.value === "" && o.disabled)).findIndex((o) => o.value === value)));
    setOpen(true);
  }

  return (
    <span className="relative block">
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openList();
          }
        }}
        className={`${className} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selected && !(selected.value === "" && selected.disabled) ? "" : "text-muted"}`}>
          {selected && !(selected.value === "" && selected.disabled) ? selected.label : placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </button>
      {name && <input type="hidden" name={name} value={value} />}
      {/* Lets the browser's "required" check stop an empty submit. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          onInvalid={() => button.current?.focus()}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
        />
      )}
      <div
        ref={panel}
        popover="manual"
        className="fixed m-0 overflow-hidden rounded-xl border border-line bg-surface p-0 text-ink shadow-xl"
        // The list sits inside the field's <label>; without this a click here
        // would be forwarded to the button and reopen the list.
        onClick={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            button.current?.focus();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (shown[active]) choose(shown[active]);
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 text-muted" />
          <input
            ref={search}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search…"
            aria-label="Search options"
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matches</li>}
          {shown.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
              className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${i === active ? "bg-canvas" : ""} ${o.disabled ? "opacity-50" : ""}`}
            >
              <span>{o.label}</span>
              {o.value === value && <Check className="size-4 text-ink" />}
            </li>
          ))}
        </ul>
      </div>
    </span>
  );
}
