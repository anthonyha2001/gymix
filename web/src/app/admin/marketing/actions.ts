"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/session";
import { syncSocialAccount } from "@/lib/social";

export async function addAccount(input: { platform: string; handle: string; followers?: number | null }) {
  await requirePlatformAdmin();
  const handle = input.handle.trim().replace(/^@/, "");
  if (!["instagram", "facebook", "tiktok"].includes(input.platform) || handle.length < 1) return { error: "Pick a platform and write the account name." };
  const supabase = await createClient();
  const { error } = await supabase.from("social_accounts").insert({ platform: input.platform, handle, followers: input.followers ?? null });
  if (error) return { error: error.code === "23505" ? "That account is already here." : error.message };
  refresh();
  return { ok: true as const };
}

// Saves the access token (server side only) and syncs right away.
export async function connectAccount(accountId: string, input: { token: string; externalId?: string }) {
  await requirePlatformAdmin();
  if (input.token.trim().length < 20) return { error: "Paste the full access token." };
  const admin = createAdminClient();
  if (input.externalId?.trim()) await admin.from("social_accounts").update({ external_id: input.externalId.trim() }).eq("id", accountId);
  const { error } = await admin.from("social_tokens").upsert({ account_id: accountId, token: input.token.trim(), updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  const r = await syncSocialAccount(accountId);
  refresh();
  return r.error ? { error: `Saved, but the first sync failed: ${r.error}` } : { ok: true as const, posts: r.posts };
}

export async function syncNow(accountId: string) {
  await requirePlatformAdmin();
  const r = await syncSocialAccount(accountId);
  refresh();
  return r;
}

export async function removeAccount(accountId: string) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.from("social_accounts").delete().eq("id", accountId);
  refresh();
}

// A post added by hand (accounts that aren't connected), or its numbers updated.
export async function savePost(input: {
  id?: string;
  accountId: string;
  postedAt: string;
  kind: string;
  caption: string;
  permalink: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const row = {
    account_id: input.accountId,
    posted_at: new Date(input.postedAt || Date.now()).toISOString(),
    kind: ["post", "reel", "video", "story", "carousel"].includes(input.kind) ? input.kind : "post",
    caption: input.caption.trim().slice(0, 2200) || null,
    permalink: input.permalink.trim().slice(0, 500) || null,
    views: Math.max(0, Math.round(input.views || 0)),
    reach: Math.max(0, Math.round(input.reach || 0)),
    likes: Math.max(0, Math.round(input.likes || 0)),
    comments: Math.max(0, Math.round(input.comments || 0)),
    shares: Math.max(0, Math.round(input.shares || 0)),
    saves: Math.max(0, Math.round(input.saves || 0)),
  };
  const { error } = input.id ? await supabase.from("social_posts").update(row).eq("id", input.id) : await supabase.from("social_posts").insert(row);
  if (error) return { error: error.message };
  refresh();
  return { ok: true as const };
}
