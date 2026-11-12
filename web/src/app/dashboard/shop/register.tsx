"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Minus, Plus, Printer, ScanBarcode, Search, ShoppingBag, Trash2, UserRound, X } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { isNativeApp } from "@/lib/native";
import { nativeScan } from "@/lib/scan";
import { Modal } from "@/components/dialog";
import { showToast } from "@/components/toaster";
import { Alert, Button, buttonClass, inputClass } from "@/components/ui";
import { formatLBP, formatUSD, usdToLbp } from "@/lib/format";
import { searchMembers, type MemberHit } from "../members/actions";
import { checkout, type CheckoutResult } from "./actions";

export type RegisterProduct = { id: string; name: string; category: string | null; barcode: string | null; price: number; stock: number; trackStock: boolean };

const METHODS = [
  { value: "cash_usd", label: "Cash $" },
  { value: "cash_lbp", label: "Cash LBP" },
  { value: "card", label: "Card" },
  { value: "whish", label: "Whish" },
  { value: "omt", label: "OMT" },
  { value: "account", label: "On account" },
] as const;

type Sale = NonNullable<CheckoutResult["sale"]>;

export function Register({ products, lbpRate }: { products: RegisterProduct[]; lbpRate: number }) {
  const router = useRouter();
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [method, setMethod] = useState<string>("cash_usd");
  const [discount, setDiscount] = useState("");
  const [member, setMember] = useState<MemberHit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const byBarcode = useMemo(() => new Map(products.filter((p) => p.barcode).map((p) => [p.barcode!.toUpperCase(), p])), [products]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))] as string[], [products]);

  const inCart = (id: string) => cart.get(id) ?? 0;
  const add = (p: RegisterProduct, n = 1) => {
    setError(null);
    setCart((c) => {
      const next = new Map(c);
      const want = (next.get(p.id) ?? 0) + n;
      if (p.trackStock && want > p.stock) {
        setError(p.stock > 0 ? `Only ${p.stock} ${p.name} in stock.` : `${p.name} is out of stock.`);
        return c;
      }
      if (want <= 0) next.delete(p.id);
      else next.set(p.id, Math.min(want, 999));
      return next;
    });
  };
  const scanned = (code: string) => {
    const p = byBarcode.get(code.trim().toUpperCase());
    if (p) {
      add(p);
      showToast(`${p.name} added`);
    } else showToast(`No product with barcode ${code}`, "error");
  };

  // USB/Bluetooth scanners type the code very fast and end with Enter.
  const buffer = useRef({ text: "", last: 0 });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA") && !target.dataset.scan;
      const now = Date.now();
      const b = buffer.current;
      if (now - b.last > 80) b.text = "";
      b.last = now;
      if (e.key === "Enter") {
        if (b.text.length >= 4 && (!typing || target?.dataset.scan)) {
          e.preventDefault();
          scanned(b.text);
        }
        b.text = "";
      } else if (e.key.length === 1) b.text += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const lines = [...cart.entries()].map(([id, qty]) => ({ product: byId.get(id)!, qty })).filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const off = Math.min(Math.max(0, Number(discount.replace(/[$,\s]/g, "")) || 0), subtotal);
  const total = Math.round((subtotal - off) * 100) / 100;
  const lbp = usdToLbp(total, lbpRate);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const shown = products.filter((p) => {
    if (category && p.category !== category) return false;
    const q = query.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q);
  });

  const charge = () => {
    setError(null);
    if (method === "account" && !member) return setError("Choose the member to put it on.");
    start(async () => {
      const result = await checkout({
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        method,
        memberId: member?.id ?? null,
        discount: off,
        amountLbp: method === "cash_lbp" ? lbp : null,
      });
      if (result.error || !result.sale) return setError(result.error ?? "Couldn't complete the sale.");
      setReceipt(result.sale);
      setCart(new Map());
      setDiscount("");
      setMember(null);
      setMethod("cash_usd");
      router.refresh();
    });
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
      {/* Products */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <input
              data-scan="1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && shown.length === 1) {
                  add(shown[0]);
                  setQuery("");
                }
              }}
              placeholder="Search or scan a barcode"
              aria-label="Search products"
              className={`${inputClass} pl-10`}
            />
          </div>
          <button
            type="button"
            onClick={async () => {
              // In the app: the phone's native scanner (fast, and works on iPhone too).
              if (isNativeApp()) {
                const code = await nativeScan();
                if (code) {
                  haptics.success();
                  scanned(code);
                }
                return;
              }
              setScanning(true);
            }}
            className={buttonClass("secondary", "shrink-0")} aria-label="Scan with the camera" title="Scan with the camera">
            <Camera className="size-4" />
          </button>
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {[null, ...categories].map((c) => (
              <button
                key={c ?? "all"}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-sm ring-1 transition ${category === c ? "bg-ink text-white ring-ink" : "bg-surface ring-line hover:bg-canvas"}`}
              >
                {c ?? "All"}
              </button>
            ))}
          </div>
        )}
        {!products.length ? (
          <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">No products yet. Add them in the Products tab.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => {
              const out = p.trackStock && p.stock - inCart(p.id) <= 0;
              const n = inCart(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={out && !n}
                  onClick={() => add(p)}
                  className={`relative flex min-h-24 flex-col justify-between rounded-xl border p-3 text-left transition active:scale-[0.98] disabled:opacity-45 ${n ? "border-ink bg-surface shadow-sm" : "border-line bg-surface hover:border-ink/30"}`}
                >
                  <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                  <span className="mt-2 flex items-end justify-between gap-2">
                    <span className="font-semibold tabular-nums">{formatUSD(p.price)}</span>
                    {p.trackStock && <span className={`text-xs ${p.stock <= 0 ? "text-danger" : "text-muted"}`}>{p.stock <= 0 ? "Out of stock" : `${p.stock} left`}</span>}
                  </span>
                  {n > 0 && <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-brand text-xs font-bold">{n}</span>}
                </button>
              );
            })}
          </div>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ScanBarcode className="size-3.5" /> A barcode scanner works anywhere on this page.
        </p>
      </div>

      {/* Basket */}
      <div className="rounded-2xl border border-line bg-surface lg:sticky lg:top-6">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <ShoppingBag className="size-4" /> Basket
          </p>
          {count > 0 && (
            <button type="button" onClick={() => setCart(new Map())} className="text-sm text-muted hover:text-danger">
              Clear
            </button>
          )}
        </div>
        {!lines.length ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Tap a product or scan its barcode.</p>
        ) : (
          <ul className="max-h-72 divide-y divide-line overflow-y-auto">
            {lines.map(({ product: p, qty }) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="text-xs text-muted">{formatUSD(p.price)} each</span>
                </span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => add(p, -1)} className="grid size-7 place-items-center rounded-lg ring-1 ring-line hover:bg-canvas" aria-label={`One less ${p.name}`}>
                    {qty === 1 ? <Trash2 className="size-3.5" /> : <Minus className="size-3.5" />}
                  </button>
                  <span className="w-7 text-center font-semibold tabular-nums">{qty}</span>
                  <button type="button" onClick={() => add(p)} className="grid size-7 place-items-center rounded-lg ring-1 ring-line hover:bg-canvas" aria-label={`One more ${p.name}`}>
                    <Plus className="size-3.5" />
                  </button>
                </span>
                <span className="w-16 text-right font-medium tabular-nums">{formatUSD(p.price * qty)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 border-t border-line p-4">
          <MemberPicker member={member} onChange={setMember} />
          <div className="flex items-center justify-between gap-3 text-sm">
            <label htmlFor="pos-discount" className="text-muted">
              Discount
            </label>
            <div className="relative w-28">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">$</span>
              <input id="pos-discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className={`${inputClass} h-9 pl-7 text-right`} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Paid by">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={method === m.value}
                onClick={() => setMethod(m.value)}
                className={`h-9 rounded-lg text-sm font-medium ring-1 transition ${method === m.value ? "bg-ink text-white ring-ink" : "bg-surface ring-line hover:bg-canvas"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {method === "account" && <p className="text-xs text-muted">Added to the member&apos;s invoices, to pay later at the desk.</p>}
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex items-end justify-between pt-1">
            <span className="text-sm text-muted">
              Total{off > 0 && <span className="block text-xs">after {formatUSD(off)} off</span>}
            </span>
            <span className="text-right">
              <span className="block text-3xl font-semibold tabular-nums">{formatUSD(total)}</span>
              {method === "cash_lbp" && total > 0 && <span className="block text-sm font-medium text-muted">{formatLBP(lbp)}</span>}
            </span>
          </div>
          <Button className="h-12 w-full text-base" disabled={!lines.length || pending} onClick={charge}>
            {pending ? "Charging…" : lines.length ? `Charge ${formatUSD(total)}` : "Charge"}
          </Button>
        </div>
      </div>

      <Modal open={Boolean(receipt)} onClose={() => setReceipt(null)} title={receipt ? `Sale #${receipt.number}` : ""}>
        {receipt && <Receipt sale={receipt} onDone={() => setReceipt(null)} />}
      </Modal>
      {scanning && <CameraScanner onCode={(c) => { setScanning(false); scanned(c); }} onClose={() => setScanning(false)} />}
    </div>
  );
}

function Receipt({ sale, onDone }: { sale: Sale; onDone: () => void }) {
  const methodLabel = METHODS.find((m) => m.value === sale.method)?.label ?? sale.method;
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 font-medium text-success">
        <CheckCircle2 className="size-5" /> {sale.method === "account" ? `Put on ${sale.memberName}'s account` : `Paid · ${methodLabel}`}
      </p>
      <ul className="divide-y divide-line rounded-xl border border-line text-sm">
        {sale.lines.map((l) => (
          <li key={l.name} className="flex justify-between gap-3 px-3 py-2">
            <span>
              {l.quantity} × {l.name}
            </span>
            <span className="tabular-nums">{formatUSD(l.amount)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 px-3 py-2 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatUSD(sale.total)}</span>
        </li>
      </ul>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => window.print()} className={buttonClass("secondary")}>
          <Printer className="size-4" /> Print
        </button>
        <Button onClick={onDone} autoFocus>
          New sale
        </Button>
      </div>
    </div>
  );
}

function MemberPicker({ member, onChange }: { member: MemberHit | null; onChange: (m: MemberHit | null) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [, start] = useTransition();
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setHits(await searchMembers(q))), 200);
    return () => clearTimeout(t);
  }, [q]);

  if (member) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <UserRound className="size-4 shrink-0 text-muted" />
          <span className="truncate font-medium">{member.fullName}</span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-muted hover:text-ink" aria-label="Remove member">
          <X className="size-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <UserRound className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Member (optional)" aria-label="Member" className={`${inputClass} h-9 pl-10`} />
      {q.trim().length >= 2 && hits.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(h);
                  setQ("");
                  setHits([]);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas"
              >
                <span className="font-medium">{h.fullName}</span>
                <span className="text-xs text-muted">{h.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Camera barcode scanning where the browser can (Chrome on Android and desktop).
type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

function CameraScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!Ctor) {
      queueMicrotask(() => setProblem("This browser can't read barcodes with the camera. Use a barcode scanner, or Chrome on Android."));
      return;
    }
    const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        stream = s;
        if (stopped || !video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          const found = await detector.detect(video.current).catch(() => []);
          if (found[0]?.rawValue) onCode(found[0].rawValue);
          else timer = window.setTimeout(tick, 200);
        };
        tick();
      })
      .catch(() => setProblem("Gymix couldn't open the camera. Allow camera access and try again."));
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <Modal open onClose={onClose} title="Scan a barcode">
      {problem ? (
        <Alert tone="error">{problem}</Alert>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={video} playsInline muted className="aspect-[4/3] w-full object-cover" />
          <span className="scan-line pointer-events-none absolute inset-x-8 h-0.5 rounded-full bg-brand shadow-[0_0_12px_rgba(200,241,53,0.9)]" />
        </div>
      )}
    </Modal>
  );
}
