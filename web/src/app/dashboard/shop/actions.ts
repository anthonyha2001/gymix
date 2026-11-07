"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { BILLING_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { hasFeature } from "@/lib/features";
import { errorMessage, money, text, type ActionState } from "@/lib/action-result";
import { kickAccess } from "@/lib/access/server";

async function requireShop(roles = BILLING_ROLES) {
  const ctx = await requireStaff(roles);
  if (!(await hasFeature(ctx.membership.gymId, "pos"))) redirect("/dashboard");
  return ctx;
}

export type CheckoutResult = { error?: string; sale?: { id: string; number: number; total: number; lines: { name: string; quantity: number; amount: number }[]; method: string; memberName: string | null } };

export async function checkout(input: {
  items: { productId: string; quantity: number }[];
  method: string;
  memberId: string | null;
  discount: number;
  amountLbp: number | null;
}): Promise<CheckoutResult> {
  const { membership } = await requireShop();
  if (!input.items.length) return { error: "The basket is empty." };
  const supabase = await createClient();
  const { data: saleId, error } = await supabase.rpc("pos_checkout", {
    p_gym_id: membership.gymId,
    p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_method: input.method,
    p_member_id: input.memberId ?? undefined,
    p_discount: input.discount || 0,
    p_amount_lbp: input.method === "cash_lbp" && input.amountLbp ? input.amountLbp : undefined,
  });
  if (error || !saleId) return { error: errorMessage(error ?? { message: "" }, "Couldn't complete the sale.") };
  // An account sale is an invoice: door access and billing follow it.
  if (input.method === "account") kickAccess(membership.gymId);

  const { data: sale } = await supabase
    .from("sales")
    .select("id, number, total_usd, method, members(full_name), sale_items(name, quantity, unit_price)")
    .eq("id", saleId)
    .single();
  refresh();
  return {
    sale: sale
      ? {
          id: sale.id,
          number: sale.number,
          total: Number(sale.total_usd),
          method: sale.method ?? "account",
          memberName: sale.members?.full_name ?? null,
          lines: sale.sale_items.map((l) => ({ name: l.name, quantity: l.quantity, amount: l.quantity * Number(l.unit_price) })),
        }
      : undefined,
  };
}

function readProduct(formData: FormData) {
  const name = text(formData, "name");
  const category = text(formData, "category") || null;
  const barcode = text(formData, "barcode").replace(/\s/g, "") || null;
  const price = money(formData, "price_usd");
  const costRaw = text(formData, "cost_usd");
  const cost = costRaw ? money(formData, "cost_usd") : null;
  const lowRaw = text(formData, "low_stock_at");
  const low = lowRaw ? Number(lowRaw) : 5;
  if (!name || name.length > 80) return { error: "Give the product a name." };
  if (!Number.isFinite(price) || price < 0) return { error: "Enter a valid price." };
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return { error: "Enter a valid cost, or leave it empty." };
  if (barcode && !/^[0-9A-Za-z-]{4,32}$/.test(barcode)) return { error: "A barcode is 4 to 32 letters or digits (scan it into the field)." };
  if (!Number.isInteger(low) || low < 0) return { error: "Low-stock warning is a whole number." };
  return { product: { name, category, barcode, price_usd: price, cost_usd: cost, low_stock_at: low, track_stock: formData.get("track_stock") !== "off" } };
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireShop(MANAGER_ROLES);
  const parsed = readProduct(formData);
  if (!parsed.product) return { error: parsed.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").insert({ ...parsed.product, gym_id: membership.gymId }).select("id").single();
  if (error) return { error: error.code === "23505" ? "Another product already has this barcode." : errorMessage(error, "Couldn't add the product.") };
  const opening = Number(text(formData, "opening_stock") || "0");
  if (parsed.product.track_stock && Number.isInteger(opening) && opening > 0) {
    await supabase.rpc("pos_receive_stock", { p_product_id: data.id, p_quantity: opening, p_note: "Opening stock" });
  }
  refresh();
  return { success: `${parsed.product.name} added.` };
}

export async function updateProduct(productId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireShop(MANAGER_ROLES);
  const parsed = readProduct(formData);
  if (!parsed.product) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from("products").update(parsed.product).eq("id", productId).eq("gym_id", membership.gymId);
  if (error) return { error: error.code === "23505" ? "Another product already has this barcode." : errorMessage(error, "Couldn't save the product.") };
  refresh();
  return { success: "Saved." };
}

export async function setProductActive(productId: string, active: boolean): Promise<ActionState> {
  const { membership } = await requireShop(MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ is_active: active }).eq("id", productId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't update the product.") };
  refresh();
  return { success: active ? "Back on sale." : "Archived: no longer sold." };
}

export async function receiveStock(productId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireShop(MANAGER_ROLES);
  const qty = Number(text(formData, "quantity"));
  const costRaw = text(formData, "unit_cost");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_receive_stock", {
    p_product_id: productId,
    p_quantity: qty,
    p_unit_cost: costRaw ? money(formData, "unit_cost") : undefined,
    p_note: text(formData, "note") || undefined,
  });
  if (error) return { error: errorMessage(error, "Couldn't record the delivery.") };
  refresh();
  return { success: `Delivery recorded. ${data} in stock.` };
}

export async function countStock(productId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireShop(MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_count_stock", {
    p_product_id: productId,
    p_counted: Number(text(formData, "counted")),
    p_note: text(formData, "note") || undefined,
  });
  if (error) return { error: errorMessage(error, "Couldn't save the count.") };
  refresh();
  return { success: "Stock count saved." };
}

export async function refundSale(saleId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireShop(MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_refund", { p_sale_id: saleId, p_reason: text(formData, "reason") || undefined });
  if (error) return { error: errorMessage(error, "Couldn't refund the sale.") };
  kickAccess(membership.gymId);
  refresh();
  return { success: "Refunded. The items are back in stock." };
}
