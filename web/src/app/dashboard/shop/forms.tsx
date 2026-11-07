"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { AffixInput, ChoiceChips } from "@/components/form-controls";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { formatUSD } from "@/lib/format";
import type { ActionState } from "@/lib/action-result";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export type ProductValues = {
  name: string;
  category: string | null;
  barcode: string | null;
  price_usd: number;
  cost_usd: number | null;
  track_stock: boolean;
  low_stock_at: number;
};

export function ProductForm({ action, initial, categories, submitLabel }: { action: Action; initial?: ProductValues; categories: string[]; submitLabel: string }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [price, setPrice] = useState(initial ? String(initial.price_usd) : "");
  const [cost, setCost] = useState(initial?.cost_usd != null ? String(initial.cost_usd) : "");
  const [track, setTrack] = useState(initial?.track_stock ?? true);
  const p = Number(price);
  const c = Number(cost);
  const margin = price && cost && p > 0 ? Math.round(((p - c) / p) * 100) : null;

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" required maxLength={80} defaultValue={initial?.name} placeholder="e.g. Whey protein 1kg" className={inputClass} autoFocus={!initial} />
        </Field>
        <Field label="Category" optional>
          <input name="category" maxLength={40} defaultValue={initial?.category ?? ""} list="pos-categories" placeholder="e.g. Supplements" className={inputClass} />
          <datalist id="pos-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Barcode" optional hint="Click here and scan the product with your barcode scanner.">
        <input name="barcode" data-scan="1" defaultValue={initial?.barcode ?? ""} placeholder="Scan or type" spellCheck={false} className={`${inputClass} font-mono`} onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price">
          <AffixInput prefix="$" name="price_usd" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="45" />
        </Field>
        <Field label="Cost" optional hint={margin !== null ? `Margin ${margin}% (${formatUSD(p - c)} per item)` : "What you pay per item, for profit reports."}>
          <AffixInput prefix="$" name="cost_usd" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="30" />
        </Field>
      </div>
      <Field label="Stock" group>
        <ChoiceChips
          name="track_stock"
          label="Stock"
          value={track ? "on" : "off"}
          onChange={(v) => setTrack(v === "on")}
          options={[
            { value: "on", label: "Count stock" },
            { value: "off", label: "Don't count (services, rentals)" },
          ]}
        />
      </Field>
      {track && (
        <div className="grid gap-4 sm:grid-cols-2">
          {!initial && (
            <Field label="In stock now" optional>
              <input name="opening_stock" type="number" min={0} max={100000} placeholder="0" className={inputClass} />
            </Field>
          )}
          <Field label="Warn when down to" hint="Shown as low stock.">
            <input name="low_stock_at" type="number" min={0} max={100000} defaultValue={initial?.low_stock_at ?? 5} className={inputClass} />
          </Field>
        </div>
      )}
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

export function ReceiveForm({ action, cost }: { action: Action; cost: number | null }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How many arrived">
          <input name="quantity" type="number" min={1} max={100000} required className={inputClass} autoFocus />
        </Field>
        <Field label="Cost per item" optional hint={cost != null ? `Now ${formatUSD(cost)}` : undefined}>
          <AffixInput prefix="$" name="unit_cost" inputMode="decimal" placeholder={cost != null ? String(cost) : "30"} />
        </Field>
      </div>
      <Field label="Note" optional>
        <input name="note" maxLength={200} placeholder="e.g. Supplier invoice 1043" className={inputClass} />
      </Field>
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving…" : "Record delivery"}</Button>
      </div>
    </form>
  );
}

export function CountForm({ action, stock }: { action: Action; stock: number }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="On the shelf now" hint={`Gymix expects ${stock}. The difference is recorded.`}>
        <input name="counted" type="number" min={0} max={100000} required defaultValue={stock} className={inputClass} autoFocus />
      </Field>
      <Field label="Note" optional>
        <input name="note" maxLength={200} placeholder="e.g. Monthly count, 2 damaged" className={inputClass} />
      </Field>
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving…" : "Save count"}</Button>
      </div>
    </form>
  );
}

export function RefundForm({ action, onAccount }: { action: Action; onAccount: boolean }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <p className="text-sm text-muted">
        {onAccount ? "The items go back in stock and the member's invoice is voided." : "The items go back in stock. Give the money back the way it was paid."}
      </p>
      <Field label="Reason" optional>
        <input name="reason" maxLength={200} placeholder="e.g. Wrong flavour" className={inputClass} autoFocus />
      </Field>
      <div className="flex justify-end">
        <Button variant="danger" disabled={pending}>
          {pending ? "Refunding…" : "Refund sale"}
        </Button>
      </div>
    </form>
  );
}
