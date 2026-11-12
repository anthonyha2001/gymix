import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

// Pulls posts, followers and audience from Instagram, Facebook and TikTok for
// the accounts connected in the control room (Marketing). Tokens are kept in
// public.social_tokens (server only).
//   Instagram: a Business/Creator account linked to a Facebook Page; token
//              from Meta (Graph API, instagram_basic + instagram_manage_insights).
//   Facebook:  a Page access token (pages_read_engagement, read_insights).
//   TikTok:    a TikTok for Developers user token (user.info.stats, video.list).

const GRAPH = "https://graph.facebook.com/v21.0";

type Post = {
  external_id: string;
  posted_at: string;
  kind: "post" | "reel" | "video" | "story" | "carousel";
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.error) {
    const e = json.error as { message?: string } | undefined;
    throw new Error(e?.message ?? `HTTP ${res.status}`);
  }
  return json;
}

async function instagram(id: string, token: string) {
  const profile = await getJson(`${GRAPH}/${id}?fields=followers_count,follows_count,media_count,username&access_token=${token}`);
  const media = await getJson(
    `${GRAPH}/${id}/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count&limit=50&access_token=${token}`,
  );
  const posts: Post[] = [];
  for (const m of (media.data as Record<string, unknown>[]) ?? []) {
    const kind = m.media_product_type === "REELS" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : m.media_type === "VIDEO" ? "video" : "post";
    const insights: Record<string, number> = {};
    for (const metrics of ["reach,saved,shares,views", "reach,saved"]) {
      try {
        const ins = await getJson(`${GRAPH}/${m.id}/insights?metric=${metrics}&access_token=${token}`);
        for (const x of (ins.data as { name: string; values: { value: number }[] }[]) ?? []) insights[x.name] = Number(x.values?.[0]?.value ?? 0);
        break;
      } catch {
        // Some metrics don't exist for some kinds of post; try fewer.
      }
    }
    posts.push({
      external_id: String(m.id),
      posted_at: String(m.timestamp),
      kind,
      caption: m.caption ? String(m.caption).slice(0, 2200) : null,
      permalink: (m.permalink as string) ?? null,
      thumbnail_url: ((m.thumbnail_url ?? m.media_url) as string) ?? null,
      views: insights.views ?? 0,
      reach: insights.reach ?? 0,
      likes: Number(m.like_count ?? 0),
      comments: Number(m.comments_count ?? 0),
      shares: insights.shares ?? 0,
      saves: insights.saved ?? 0,
    });
  }
  // Who follows: country, city, age and gender (accounts with 100+ followers).
  const audience: Record<string, Record<string, number>> = {};
  for (const breakdown of ["country", "city", "age", "gender"]) {
    try {
      const a = await getJson(`${GRAPH}/${id}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=${breakdown}&access_token=${token}`);
      const results = ((a.data as { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[])?.[0]?.total_value?.breakdowns?.[0]?.results ?? []);
      audience[breakdown] = Object.fromEntries(results.map((r) => [r.dimension_values[0], r.value]));
    } catch {}
  }
  let daily: { reach?: number; profile_views?: number } = {};
  try {
    const d = await getJson(`${GRAPH}/${id}/insights?metric=reach,profile_views&period=day&metric_type=total_value&access_token=${token}`);
    for (const x of (d.data as { name: string; total_value?: { value: number } }[]) ?? []) daily = { ...daily, [x.name]: Number(x.total_value?.value ?? 0) };
  } catch {}
  return { followers: Number(profile.followers_count ?? 0), following: Number(profile.follows_count ?? 0), posts_count: Number(profile.media_count ?? 0), posts, audience, daily };
}

async function facebook(id: string, token: string) {
  const page = await getJson(`${GRAPH}/${id}?fields=followers_count,fan_count,name&access_token=${token}`);
  const feed = await getJson(
    `${GRAPH}/${id}/posts?fields=id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)&limit=50&access_token=${token}`,
  );
  const posts: Post[] = ((feed.data as Record<string, unknown>[]) ?? []).map((p) => ({
    external_id: String(p.id),
    posted_at: String(p.created_time),
    kind: "post",
    caption: p.message ? String(p.message).slice(0, 2200) : null,
    permalink: (p.permalink_url as string) ?? null,
    thumbnail_url: (p.full_picture as string) ?? null,
    views: 0,
    reach: 0,
    likes: Number((p.reactions as { summary?: { total_count?: number } })?.summary?.total_count ?? 0),
    comments: Number((p.comments as { summary?: { total_count?: number } })?.summary?.total_count ?? 0),
    shares: Number((p.shares as { count?: number })?.count ?? 0),
    saves: 0,
  }));
  return { followers: Number(page.followers_count ?? page.fan_count ?? 0), following: null, posts_count: posts.length, posts, audience: {}, daily: {} };
}

async function tiktok(token: string) {
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const user = await getJson("https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,video_count,display_name", { headers });
  const u = ((user.data as { user?: Record<string, number> })?.user ?? {}) as Record<string, number>;
  const list = await getJson(
    "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count",
    { method: "POST", headers, body: JSON.stringify({ max_count: 20 }) },
  );
  const posts: Post[] = (((list.data as { videos?: Record<string, unknown>[] })?.videos) ?? []).map((v) => ({
    external_id: String(v.id),
    posted_at: new Date(Number(v.create_time) * 1000).toISOString(),
    kind: "video",
    caption: (v.video_description ?? v.title ?? null) as string | null,
    permalink: (v.share_url as string) ?? null,
    thumbnail_url: (v.cover_image_url as string) ?? null,
    views: Number(v.view_count ?? 0),
    reach: Number(v.view_count ?? 0),
    likes: Number(v.like_count ?? 0),
    comments: Number(v.comment_count ?? 0),
    shares: Number(v.share_count ?? 0),
    saves: 0,
  }));
  return { followers: Number(u.follower_count ?? 0), following: Number(u.following_count ?? 0), posts_count: Number(u.video_count ?? posts.length), posts, audience: {}, daily: {} };
}

// Syncs one account. Returns how many posts were updated.
export async function syncSocialAccount(accountId: string): Promise<{ posts?: number; error?: string }> {
  const admin = createAdminClient();
  const [{ data: account }, { data: tok }] = await Promise.all([
    admin.from("social_accounts").select("id, platform, external_id").eq("id", accountId).maybeSingle(),
    admin.from("social_tokens").select("token").eq("account_id", accountId).maybeSingle(),
  ]);
  if (!account) return { error: "Account not found." };
  if (!tok?.token) return { error: "Connect the account first (paste its access token)." };
  try {
    const r =
      account.platform === "instagram"
        ? await instagram(account.external_id ?? "", tok.token)
        : account.platform === "facebook"
          ? await facebook(account.external_id ?? "", tok.token)
          : await tiktok(tok.token);
    const now = new Date().toISOString();
    if (r.posts.length) {
      await admin.from("social_posts").upsert(
        r.posts.map((p) => ({ ...p, account_id: account.id, last_synced_at: now })),
        { onConflict: "account_id,external_id" },
      );
    }
    await admin
      .from("social_accounts")
      .update({
        followers: r.followers,
        following: r.following,
        posts_count: r.posts_count,
        ...(Object.keys(r.audience).length ? { audience: r.audience as Json } : {}),
        connected: true,
        last_synced_at: now,
        sync_error: null,
      })
      .eq("id", account.id);
    await admin.from("social_daily").upsert(
      { account_id: account.id, day: now.slice(0, 10), followers: r.followers, reach: (r.daily as { reach?: number }).reach ?? null, profile_views: (r.daily as { profile_views?: number }).profile_views ?? null },
      { onConflict: "account_id,day" },
    );
    return { posts: r.posts.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    await admin.from("social_accounts").update({ sync_error: message.slice(0, 500) }).eq("id", account.id);
    return { error: message };
  }
}

export async function syncAllSocial() {
  const admin = createAdminClient();
  const { data } = await admin.from("social_accounts").select("id").eq("connected", true);
  const results = [];
  for (const a of data ?? []) results.push(await syncSocialAccount(a.id));
  return results;
}
