import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AlertTriangle, PackagePlus, Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { RowMenu } from "@/components/row-menu";
import { activeTab, PageTabs, TabPanel } from "@/components/page-tabs";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { PAYMENT_METHOD_LABELS, addDays, formatDateTime, formatUSD, todayIn, type PaymentMethod } from "@/lib/format";
import { hasFeature } from "@/lib/features";
import { BILLING_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { countStock, createProduct, receiveStock, refundSale, setProductActive, updateProduct } from "./actions";
import { CountForm, ProductForm, ReceiveForm, RefundForm } from "./forms";
import { Register } from "./register";
import { RevenueChart } from "./revenue-chart";

export const metadata: Metadata = { title: "Shop" };

const TABS = ["register", "sales", "products", "stock", "reports"] as const;
const RANGES = { today: "Today", "7d": "7 days", "30d": "30 days", month: "This month" } as const;

export default function ShopPage({ searchParams }: PageProps<"/dashboard/shop">) {
  return (
    <div className="max-w-6xl space-y-6">
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <ShopContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ShopContent({ searchParams }: { searchParams: PageProps<"/dashboard/shop">["searchParams"] }) {
  const params = await searchParams;
  const { membership } = await requireStaff(BILLING_ROLES);
  if (!(await hasFeature(membership.gymId, "pos"))) redirect("/dashboard");
  const manager = MANAGER_ROLES.includes(membership.role);
  const tabs = TABS.filter((t) => manager || t === "register" || t === "sales");
  const tab = activeTab(params.tab, tabs);
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, category, barcode, price_usd, cost_usd, track_stock, stock, low_stock_at, is_active")
    .eq("gym_id", membership.gymId)
    .order("name");
  const all = products ?? [];
  const active = all.filter((p) => p.is_active);
  const low = active.filter((p) => p.track_stock && p.stock <= p.low_stock_at);
  const categories = [...new Set(all.map((p) => p.category).filter(Boolean))] as string[];

  return (
    <>
      <PageHeader
        title="Shop"
        description="Sell supplements, drinks and merchandise. Scan, tap, charge."
        action={
          manager && (
            <Dialog label="New product" icon={<Plus className="size-4" />} title="New product" size="lg">
              <ProductForm action={createProduct} categories={categories} submitLabel="Add product" />
            </Dialog>
          )
        }
      />
      {manager && low.length > 0 && tab !== "stock" && (
        <Link href="/dashboard/shop?tab=stock" className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            {low.length} product{low.length === 1 ? " is" : "s are"} low on stock: {low.slice(0, 3).map((p) => p.name).join(", ")}
            {low.length > 3 ? "…" : ""}
          </span>
          <span className="font-medium">See stock</span>
        </Link>
      )}
      <PageTabs
        instant
        base="/dashboard/shop"
        active={tab}
        tabs={tabs.map((t) => ({ id: t, label: { register: "Register", sales: "Sales", products: "Products", stock: "Stock", reports: "Reports" }[t], count: t === "stock" && low.length ? low.length : undefined }))}
      />

      <TabPanel id="register" tabs={tabs}>
        <Register
          lbpRate={membership.lbpRate}
          products={active.map((p) => ({ id: p.id, name: p.name, category: p.category, barcode: p.barcode, price: Number(p.price_usd), stock: p.stock, trackStock: p.track_stock }))}
        />
      </TabPanel>

      <TabPanel id="sales" tabs={tabs}>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <SalesPanel gymId={membership.gymId} timeZone={membership.timezone} manager={manager} />
        </Suspense>
      </TabPanel>

      {manager && (
        <>
          <TabPanel id="products" tabs={tabs}>
            <Card className="overflow-hidden">
              {!all.length ? (
                <EmptyState>
                  <span className="block pt-5">No products yet. Use “New product” to add what you sell, with its barcode, price and cost.</span>
                </EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-line bg-canvas/60 text-left text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-5 py-3 font-medium">Product</th>
                        <th className="px-5 py-3 text-right font-medium">Price</th>
                        <th className="hidden px-5 py-3 text-right font-medium md:table-cell">Cost</th>
                        <th className="hidden px-5 py-3 text-right font-medium md:table-cell">Margin</th>
                        <th className="px-5 py-3 text-right font-medium">Stock</th>
                        <th className="px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {all.map((p) => {
                        const price = Number(p.price_usd);
                        const cost = p.cost_usd === null ? null : Number(p.cost_usd);
                        return (
                          <tr key={p.id} className={p.is_active ? "" : "text-muted"}>
                            <td className="px-5 py-3">
                              <p className="font-medium text-ink">{p.name}</p>
                              <p className="text-xs text-muted">
                                {[p.category, p.barcode, !p.is_active && "Archived"].filter(Boolean).join(" · ")}
                              </p>
                            </td>
                            <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatUSD(price)}</td>
                            <td className="hidden px-5 py-3 text-right tabular-nums md:table-cell">{cost === null ? "–" : formatUSD(cost)}</td>
                            <td className="hidden px-5 py-3 text-right tabular-nums md:table-cell">{cost === null || price === 0 ? "–" : `${Math.round(((price - cost) / price) * 100)}%`}</td>
                            <td className="px-5 py-3 text-right">
                              <StockBadge track={p.track_stock} stock={p.stock} low={p.low_stock_at} />
                            </td>
                            <td className="px-3 py-3 text-right">
                              <RowMenu
                                label={`Actions for ${p.name}`}
                                items={[
                                  {
                                    kind: "dialog",
                                    label: "Edit",
                                    title: `Edit ${p.name}`,
                                    size: "lg",
                                    content: (
                                      <ProductForm
                                        action={updateProduct.bind(null, p.id)}
                                        categories={categories}
                                        initial={{ ...p, price_usd: price, cost_usd: cost }}
                                        submitLabel="Save changes"
                                      />
                                    ),
                                  },
                                  { kind: "dialog", label: "Record a delivery", title: `Delivery of ${p.name}`, content: <ReceiveForm action={receiveStock.bind(null, p.id)} cost={cost} /> },
                                  p.track_stock && { kind: "dialog", label: "Count stock", title: `Count ${p.name}`, content: <CountForm action={countStock.bind(null, p.id)} stock={p.stock} /> },
                                  { kind: "action", label: p.is_active ? "Archive (stop selling)" : "Put back on sale", action: setProductActive.bind(null, p.id, !p.is_active) },
                                ]}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabPanel>

          <TabPanel id="stock" tabs={tabs}>
            <Suspense fallback={<Skeleton className="h-96" />}>
              <StockPanel gymId={membership.gymId} timeZone={membership.timezone} low={low.map((p) => ({ id: p.id, name: p.name, stock: p.stock, cost: p.cost_usd === null ? null : Number(p.cost_usd) }))} />
            </Suspense>
          </TabPanel>

          <TabPanel id="reports" tabs={tabs}>
            <Suspense fallback={<Skeleton className="h-96" />}>
              <ReportsPanel gymId={membership.gymId} timeZone={membership.timezone} range={(typeof params.range === "string" && params.range in RANGES ? params.range : "30d") as keyof typeof RANGES} />
            </Suspense>
          </TabPanel>
        </>
      )}
    </>
  );
}

function StockBadge({ track, stock, low }: { track: boolean; stock: number; low: number }) {
  if (!track) return <span className="text-xs text-muted">Not counted</span>;
  if (stock <= 0) return <Badge tone="red">Out of stock</Badge>;
  if (stock <= low) return <Badge tone="amber">{stock} left</Badge>;
  return <span className="font-medium tabular-nums">{stock}</span>;
}

const METHOD_TEXT = (m: string | null) => (m ? (PAYMENT_METHOD_LABELS[m as PaymentMethod] ?? m) : "On account");

async function SalesPanel({ gymId, timeZone, manager }: { gymId: string; timeZone: string; manager: boolean }) {
  const supabase = await createClient();
  const { data: sales } = await supabase
    .from("sales")
    .select("id, number, total_usd, method, status, created_at, invoice_id, members(id, full_name), sale_items(name, quantity)")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (
    <Card>
      <SectionTitle>Latest sales</SectionTitle>
      {!sales?.length ? (
        <EmptyState>No sales yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {sales.map((s) => (
            <li key={s.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 text-sm ${s.status === "refunded" ? "text-muted" : ""}`}>
              <span className="w-12 shrink-0 font-mono text-xs text-muted">#{s.number}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{s.sale_items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</span>
                <span className="block text-xs text-muted">
                  {formatDateTime(s.created_at, timeZone)} · {METHOD_TEXT(s.method)}
                  {s.members && (
                    <>
                      {" · "}
                      <Link href={`/dashboard/members/${s.members.id}`} className="hover:underline">
                        {s.members.full_name}
                      </Link>
                    </>
                  )}
                </span>
              </span>
              {s.status === "refunded" ? <Badge tone="gray">Refunded</Badge> : s.status === "on_account" ? <Badge tone="blue">On account</Badge> : null}
              <span className={`w-20 text-right font-semibold tabular-nums ${s.status === "refunded" ? "line-through" : ""}`}>{formatUSD(s.total_usd)}</span>
              {manager && s.status !== "refunded" ? (
                <RowMenu label={`Actions for sale ${s.number}`} items={[{ kind: "dialog", label: "Refund", title: `Refund sale #${s.number}`, danger: true, content: <RefundForm action={refundSale.bind(null, s.id)} onAccount={s.status === "on_account"} /> }]} />
              ) : (
                <span className="w-9" />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function StockPanel({ gymId, timeZone, low }: { gymId: string; timeZone: string; low: { id: string; name: string; stock: number; cost: number | null }[] }) {
  const supabase = await createClient();
  const { data: moves } = await supabase
    .from("stock_movements")
    .select("id, quantity, reason, stock_after, note, created_at, products(name), sales(number)")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(60);
  const REASON = { sale: "Sold", refund: "Refunded", delivery: "Delivery", count: "Count" } as const;
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Low on stock</SectionTitle>
        {!low.length ? (
          <EmptyState>Everything is above its low-stock warning.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {low.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="flex items-center gap-3">
                  <StockBadge track stock={p.stock} low={Number.MAX_SAFE_INTEGER} />
                  <Dialog label="Delivery" icon={<PackagePlus className="size-4" />} variant="secondary" triggerClassName="h-9" title={`Delivery of ${p.name}`}>
                    <ReceiveForm action={receiveStock.bind(null, p.id)} cost={p.cost} />
                  </Dialog>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <SectionTitle>Stock history</SectionTitle>
        {!moves?.length ? (
          <EmptyState>Sales, deliveries and counts appear here.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {moves.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-28 shrink-0 text-xs text-muted tabular-nums">{formatDateTime(m.created_at, timeZone)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{m.products?.name}</span>
                  <span className="block text-xs text-muted">
                    {REASON[m.reason as keyof typeof REASON]}
                    {m.sales ? ` · sale #${m.sales.number}` : ""}
                    {m.note ? ` · ${m.note}` : ""}
                  </span>
                </span>
                <span className={`w-12 text-right font-semibold tabular-nums ${m.quantity > 0 ? "text-success" : "text-ink"}`}>
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </span>
                <span className="w-16 text-right text-xs text-muted tabular-nums">→ {m.stock_after}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

type Report = {
  revenue: number;
  cost: number;
  profit: number;
  sales: number;
  items: number;
  discounts: number;
  refunded: number;
  on_account: number;
  missing_cost: boolean;
  by_method: { method: string; total: number; count: number }[];
  by_day: { day: string; revenue: number; profit: number }[];
  top: { name: string; quantity: number; revenue: number; profit: number }[];
};

async function ReportsPanel({ gymId, timeZone, range }: { gymId: string; timeZone: string; range: keyof typeof RANGES }) {
  const today = todayIn(timeZone);
  const from = range === "today" ? today : range === "7d" ? addDays(today, -6) : range === "30d" ? addDays(today, -29) : `${today.slice(0, 8)}01`;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_report", { p_gym_id: gymId, p_from: from, p_to: today });
  const r = (data ?? null) as Report | null;
  // Every day in the range, with zero for days without sales.
  const days: Report["by_day"] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const found = r?.by_day.find((x) => x.day === d);
    days.push({ day: d, revenue: Number(found?.revenue ?? 0), profit: Number(found?.profit ?? 0) });
  }
  const margin = r && Number(r.revenue) > 0 ? Math.round((Number(r.profit) / Number(r.revenue)) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Period">
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((k) => (
          <Link
            key={k}
            href={`/dashboard/shop?tab=reports&range=${k}`}
            scroll={false}
            className={`rounded-full px-3 py-1.5 text-sm ring-1 transition ${k === range ? "bg-ink text-white ring-ink" : "bg-surface ring-line hover:bg-canvas"}`}
          >
            {RANGES[k]}
          </Link>
        ))}
      </div>
      {error || !r ? (
        <Card className="p-5 text-sm text-muted">Couldn&apos;t load the report.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Revenue", formatUSD(r.revenue), `${r.sales} sale${r.sales === 1 ? "" : "s"} · ${r.items} item${r.items === 1 ? "" : "s"}`],
              ["Profit", formatUSD(r.profit), margin === null ? "–" : `${margin}% margin`],
              ["Cost of goods", formatUSD(r.cost), r.missing_cost ? "some products have no cost" : "from product costs"],
              ["On members' accounts", formatUSD(r.on_account), `${formatUSD(r.discounts)} in discounts · ${r.refunded} refunded`],
            ].map(([k, v, sub]) => (
              <Card key={k} className="p-4">
                <p className="text-xs text-muted">{k}</p>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums">{v}</p>
                <p className="mt-1 text-xs text-muted">{sub}</p>
              </Card>
            ))}
          </div>
          {r.missing_cost && <p className="text-xs text-amber-800">Profit counts products without a cost as free. Add costs in Products for exact profit.</p>}
          {days.length > 1 && (
            <Card className="p-5">
              <h2 className="mb-4 font-semibold">Revenue by day</h2>
              <RevenueChart days={days} />
            </Card>
          )}
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <SectionTitle>Best sellers</SectionTitle>
              {!r.top.length ? (
                <EmptyState>No sales in this period.</EmptyState>
              ) : (
                <table className="w-full border-t border-line text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-5 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 text-right font-medium">Sold</th>
                      <th className="px-3 py-2 text-right font-medium">Revenue</th>
                      <th className="px-5 py-2 text-right font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {r.top.map((t) => (
                      <tr key={t.name}>
                        <td className="px-5 py-2.5 font-medium">{t.name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{t.quantity}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatUSD(t.revenue)}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{formatUSD(t.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card>
              <SectionTitle>By payment</SectionTitle>
              {!r.by_method.length ? (
                <EmptyState>No sales in this period.</EmptyState>
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {r.by_method.map((m) => (
                    <li key={m.method} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <span>
                        {m.method === "account" ? "On account" : METHOD_TEXT(m.method)}
                        <span className="ml-1 text-xs text-muted">· {m.count}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{formatUSD(m.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
