"use client";

import { useMemo, useState, useTransition } from "react";
import { Camera, ExternalLink, Heart, Loader2, Link2, MessageCircle, Music2, Plus, RefreshCcw, Repeat2, Bookmark, ThumbsUp, Trash2, X, Eye } from "lucide-react";
import { showToast } from "@/components/toaster";
import { haptics } from "@/lib/haptics";
import { AreaChart, BarList, Heatmap, Panel, Segmented, Stat, ago, fmt } from "../room-ui";
import { addAccount, connectAccount, removeAccount, savePost, syncNow } from "./actions";

export type Account = {
  id: string;
  platform: "instagram" | "facebook" | "tiktok";
  handle: string;
  external_id: string | null;
  followers: number | null;
  following: number | null;
  posts_count: number | null;
  audience: Record<string, Record<string, number>>;
  connected: boolean;
  last_synced_at: string | null;
  sync_error: string | null;
};
export type PostRow = {
  id: string;
  account_id: string;
  posted_at: string;
  kind: string | null;
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
export type DailyRow = { account_id: string; day: string; followers: number | null; reach: number | null };
export type SocialPayoff = { platform: "instagram" | "facebook" | "tiktok"; visits: number; visitors: number; requests: number; paid: number }[];

const PLATFORM = {
  instagram: { label: "Instagram", icon: Camera },
  facebook: { label: "Facebook", icon: ThumbsUp },
  tiktok: { label: "TikTok", icon: Music2 },
} as const;

const REGION = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (c: string) => {
  try {
    return /^[A-Z]{2}$/.test(c) ? (REGION.of(c) ?? c) : c;
  } catch {
    return c;
  }
};

const interactions = (p: PostRow) => p.likes + p.comments + p.shares + p.saves;
// Engagement: interactions per person reached (or per view when reach is unknown).
const engagement = (p: PostRow) => {
  const base = p.reach || p.views;
  return base ? (interactions(p) / base) * 100 : 0;
};

export function MarketingView({ accounts, posts, daily, payoff }: { accounts: Account[]; posts: PostRow[]; daily: DailyRow[]; payoff: SocialPayoff }) {
  const [platform, setPlatform] = useState<"all" | Account["platform"]>("all");
  const [adding, setAdding] = useState(false);
  const [connecting, setConnecting] = useState<Account | null>(null);
  const [editing, setEditing] = useState<PostRow | "new" | null>(null);
  const [sort, setSort] = useState<"engagement" | "views" | "recent">("engagement");

  const accIds = new Set(accounts.filter((a) => platform === "all" || a.platform === platform).map((a) => a.id));
  const ps = posts.filter((p) => accIds.has(p.account_id));
  const p30 = ps.filter((p) => new Date(p.posted_at).getTime() > new Date(posts[0]?.posted_at ?? 0).getTime() - 30 * 86_400_000);
  const followers = accounts.filter((a) => accIds.has(a.id)).reduce((n, a) => n + (a.followers ?? 0), 0);
  const views30 = p30.reduce((n, p) => n + (p.views || p.reach), 0);
  const avgEng = p30.length ? p30.reduce((n, p) => n + engagement(p), 0) / p30.length : 0;

  // Followers over time (summed across the selected accounts).
  const followerSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const d of daily) if (accIds.has(d.account_id) && d.followers != null) byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.followers);
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, y]) => ({ x, y }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, platform, accounts]);

  // Best time to post: average engagement by day of week and hour (Beirut).
  const bestTime = useMemo(() => {
    const cells = new Map<string, { sum: number; n: number }>();
    for (const p of ps) {
      const d = new Date(new Date(p.posted_at).toLocaleString("en-US", { timeZone: "Asia/Beirut" }));
      const k = `${d.getDay()}-${d.getHours()}`;
      const c = cells.get(k) ?? { sum: 0, n: 0 };
      c.sum += engagement(p);
      c.n += 1;
      cells.set(k, c);
    }
    return [...cells.entries()].map(([k, c]) => {
      const [dow, hour] = k.split("-").map(Number);
      return { dow, hour, n: Math.round((c.sum / c.n) * 10) / 10 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, platform]);

  const top = [...ps].sort((a, b) => (sort === "recent" ? b.posted_at.localeCompare(a.posted_at) : sort === "views" ? (b.views || b.reach) - (a.views || a.reach) : engagement(b) - engagement(a))).slice(0, 12);
  const audienceOf = (key: string) => {
    const merged: Record<string, number> = {};
    for (const a of accounts) if (accIds.has(a.id)) for (const [k, v] of Object.entries(a.audience?.[key] ?? {})) merged[k] = (merged[k] ?? 0) + Number(v);
    return Object.entries(merged).map(([label, value]) => ({ key: label, label, value })).sort((a, b) => b.value - a.value);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-brand uppercase">Marketing</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Your posts, your audience, your results</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented
            value={platform}
            onChange={setPlatform}
            options={[{ value: "all", label: "All" }, ...(["instagram", "facebook", "tiktok"] as const).map((p) => ({ value: p, label: PLATFORM[p].label }))]}
          />
          <button type="button" onClick={() => setAdding(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-semibold text-ink transition active:scale-95">
            <Plus className="size-4" /> Account
          </button>
        </div>
      </header>

      {/* Accounts */}
      <div className="room-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => {
          const P = PLATFORM[a.platform];
          return (
            <div key={a.id} className="room-panel rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.07]">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-white/[0.06] text-brand">
                  <P.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">@{a.handle}</span>
                  <span className="block text-xs text-white/45">{P.label}</span>
                </span>
                <button aria-label="Remove account" title="Remove" onClick={() => confirm(`Remove @${a.handle} and its posts?`) && removeAccount(a.id)} className="grid size-8 place-items-center rounded-lg text-white/30 hover:bg-white/10 hover:text-rose-300">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-black tabular-nums">{a.followers != null ? fmt(a.followers) : "–"}</p>
                  <p className="text-xs text-white/45">followers</p>
                </div>
                {a.connected ? <SyncButton id={a.id} last={a.last_synced_at} /> : (
                  <button type="button" onClick={() => setConnecting(a)} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/[0.06]">
                    <Link2 className="size-3.5" /> Connect
                  </button>
                )}
              </div>
              {a.sync_error && <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200">Last sync failed: {a.sync_error}</p>}
            </div>
          );
        })}
        {!accounts.length && (
          <button type="button" onClick={() => setAdding(true)} className="room-panel flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-white/15 text-sm text-white/50 transition hover:border-brand/50 hover:text-white sm:col-span-2 xl:col-span-3">
            <Plus className="size-5" /> Add your Instagram, Facebook or TikTok account
          </button>
        )}
      </div>

      <div className="room-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Followers" value={followers} />
        <Stat label="Posts, 30 days" value={p30.length} />
        <Stat label="Views, 30 days" value={views30} />
        <Stat label="Avg. engagement" value={avgEng} format={(n) => `${n.toFixed(1)}%`} hint="interactions per person reached" />
      </div>

      {/* What it brings */}
      <Panel title="What each network brings · last 30 days">
        <div className="grid gap-3 md:grid-cols-3">
          {payoff.map((p) => {
            const P = PLATFORM[p.platform];
            return (
              <div key={p.platform} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <P.icon className="size-4 text-brand" /> {P.label}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Visits", p.visits],
                    ["Requests", p.requests],
                    ["New gyms", p.paid],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-xl bg-white/[0.04] py-2.5">
                      <dd className="text-xl font-black tabular-nums">{fmt(v as number)}</dd>
                      <dt className="text-[10px] text-white/45">{k}</dt>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-white/40">Add ?utm_source=instagram (or facebook, tiktok) to links in your bio and posts so every visit is counted.</p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Followers over time">
          {followerSeries.length > 1 ? <AreaChart points={followerSeries} height={220} label="followers" /> : <p className="py-16 text-center text-sm text-white/40">Builds up day by day once accounts sync.</p>}
        </Panel>
        <Panel title="Best time to post · avg. engagement %">
          {bestTime.length ? <Heatmap cells={bestTime} unit="% engagement" /> : <p className="py-16 text-center text-sm text-white/40">Appears once there are posts.</p>}
        </Panel>
      </div>

      {/* Posts */}
      <Panel
        title={`Posts · ${ps.length}`}
        action={
          <div className="flex gap-2">
            <Segmented value={sort} onChange={setSort} options={[{ value: "engagement", label: "Best" }, { value: "views", label: "Most seen" }, { value: "recent", label: "Latest" }]} />
            <button type="button" onClick={() => setEditing("new")} disabled={!accounts.length} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-white/70 ring-1 ring-white/10 hover:text-white disabled:opacity-40">
              <Plus className="size-3.5" /> Post
            </button>
          </div>
        }
      >
        {!top.length ? (
          <p className="py-12 text-center text-sm text-white/40">No posts yet. Connect an account, or add a post by hand.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {top.map((p, i) => {
              const a = accounts.find((x) => x.id === p.account_id);
              const P = a ? PLATFORM[a.platform] : PLATFORM.instagram;
              const eng = engagement(p);
              return (
                <article key={p.id} className="room-panel group overflow-hidden rounded-2xl bg-[#11161f] ring-1 ring-white/[0.07]" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="relative aspect-[4/5] overflow-hidden bg-white/[0.04]">
                    {p.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail_url} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="grid size-full place-items-center">
                        <P.icon className="size-8 text-white/15" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
                      <P.icon className="size-3" /> {p.kind ?? "post"}
                    </span>
                    {i < 3 && sort === "engagement" && <span className="absolute top-2 right-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-ink">#{i + 1}</span>}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
                      <p className="text-2xl font-black tabular-nums">{eng.toFixed(1)}%</p>
                      <p className="text-[10px] text-white/60">engagement</p>
                    </div>
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 min-h-8 text-xs text-white/70">{p.caption ?? "No caption"}</p>
                    <div className="grid grid-cols-5 gap-1 text-[11px] text-white/70">
                      {[
                        [Eye, p.views || p.reach],
                        [Heart, p.likes],
                        [MessageCircle, p.comments],
                        [Repeat2, p.shares],
                        [Bookmark, p.saves],
                      ].map(([Icon, n], k) => {
                        const I = Icon as typeof Eye;
                        return (
                          <span key={k} className="flex items-center gap-1 tabular-nums">
                            <I className="size-3 text-white/35" /> {fmt(n as number)}
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-white/40">
                      <span>{ago(p.posted_at)}</span>
                      <span className="flex gap-2">
                        <button type="button" onClick={() => setEditing(p)} className="hover:text-white">
                          Edit
                        </button>
                        {p.permalink && (
                          <a href={p.permalink} target="_blank" rel="noopener" className="flex items-center gap-0.5 hover:text-white">
                            Open <ExternalLink className="size-3" />
                          </a>
                        )}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Audience */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Panel title="Followers by country">
          <BarList rows={audienceOf("country").map((r) => ({ ...r, label: countryName(r.label) }))} empty="Shown after Instagram syncs (100+ followers)." limit={6} />
        </Panel>
        <Panel title="By city">
          <BarList rows={audienceOf("city")} empty="Shown after Instagram syncs." limit={6} />
        </Panel>
        <Panel title="By age">
          <BarList rows={audienceOf("age").sort((a, b) => a.label.localeCompare(b.label))} empty="Shown after Instagram syncs." limit={7} />
        </Panel>
        <Panel title="By gender">
          <BarList rows={audienceOf("gender").map((r) => ({ ...r, label: r.label === "F" ? "Women" : r.label === "M" ? "Men" : "Other" }))} empty="Shown after Instagram syncs." />
        </Panel>
      </div>

      {adding && <AddAccount onClose={() => setAdding(false)} />}
      {connecting && <Connect account={connecting} onClose={() => setConnecting(null)} />}
      {editing && <EditPost post={editing === "new" ? null : editing} accounts={accounts} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SyncButton({ id, last }: { id: string; last: string | null }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncNow(id);
          showToast(r.error ?? `Synced ${r.posts ?? 0} posts`, r.error ? "error" : undefined);
          if (!r.error) haptics.success();
        })
      }
      className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs text-white/60 ring-1 ring-white/10 hover:text-white"
      title={last ? `Last synced ${ago(last)}` : "Sync now"}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />} {last ? ago(last) : "Sync"}
    </button>
  );
}

const field = "h-11 w-full rounded-xl bg-white/[0.05] px-3.5 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-white/30 focus:ring-2 focus:ring-brand";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4">
      <button aria-label="Close" className="room-fade absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label={title} className="room-pop relative w-full max-w-lg rounded-[2rem] bg-[#11161f] p-6 shadow-2xl ring-1 ring-white/10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-xl text-white/50 hover:bg-white/10">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddAccount({ onClose }: { onClose: () => void }) {
  const [platform, setPlatform] = useState<Account["platform"]>("instagram");
  const [handle, setHandle] = useState("");
  const [followers, setFollowers] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title="Add an account" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(["instagram", "facebook", "tiktok"] as const).map((p) => {
            const P = PLATFORM[p];
            return (
              <button key={p} type="button" onClick={() => setPlatform(p)} className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${platform === p ? "bg-brand text-ink" : "bg-white/[0.05] text-white/70 ring-1 ring-white/10"}`}>
                <P.icon className="size-4" /> {P.label}
              </button>
            );
          })}
        </div>
        <input className={field} placeholder="@account" value={handle} onChange={(e) => setHandle(e.target.value)} />
        <input className={field} placeholder="Followers today (optional)" inputMode="numeric" value={followers} onChange={(e) => setFollowers(e.target.value)} />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await addAccount({ platform, handle, followers: followers ? Number(followers) : null });
              if (r.error) return showToast(r.error, "error");
              haptics.success();
              onClose();
            })
          }
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-semibold text-ink"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add
        </button>
      </div>
    </Modal>
  );
}

function Connect({ account, onClose }: { account: Account; onClose: () => void }) {
  const [token, setToken] = useState("");
  const [externalId, setExternalId] = useState(account.external_id ?? "");
  const [pending, start] = useTransition();
  const help = {
    instagram: "Meta Business Suite → Settings → your Instagram account must be a Business or Creator account linked to a Facebook Page. In Meta's Graph API Explorer, make a long-lived token with instagram_basic, instagram_manage_insights and pages_read_engagement. The Instagram account ID is shown there too.",
    facebook: "In Meta's Graph API Explorer, pick your Page, make a long-lived Page token with pages_read_engagement and read_insights. Paste the Page ID below.",
    tiktok: "TikTok for Developers → your app with Login Kit (scopes user.info.stats and video.list) → log in with the Gymix account and paste the access token.",
  }[account.platform];
  return (
    <Modal title={`Connect @${account.handle}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-2xl bg-white/[0.04] p-4 text-xs leading-relaxed text-white/60">{help}</p>
        {account.platform !== "tiktok" && <input className={field} placeholder={account.platform === "instagram" ? "Instagram account ID" : "Page ID"} value={externalId} onChange={(e) => setExternalId(e.target.value)} />}
        <textarea className={`${field} h-24 py-3 font-mono text-xs`} placeholder="Access token" value={token} onChange={(e) => setToken(e.target.value)} />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await connectAccount(account.id, { token, externalId });
              if (r.error) return showToast(r.error, "error");
              haptics.success();
              showToast(`Connected · ${("posts" in r && r.posts) || 0} posts synced`);
              onClose();
            })
          }
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-semibold text-ink"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Connect and sync
        </button>
        <p className="text-center text-xs text-white/35">The token is stored on the server only. It never reaches a browser.</p>
      </div>
    </Modal>
  );
}

function EditPost({ post, accounts, onClose }: { post: PostRow | null; accounts: Account[]; onClose: () => void }) {
  const [f, setF] = useState({
    accountId: post?.account_id ?? accounts[0]?.id ?? "",
    postedAt: (post?.posted_at ?? new Date().toISOString()).slice(0, 16),
    kind: post?.kind ?? "post",
    caption: post?.caption ?? "",
    permalink: post?.permalink ?? "",
    views: String(post?.views ?? ""),
    reach: String(post?.reach ?? ""),
    likes: String(post?.likes ?? ""),
    comments: String(post?.comments ?? ""),
    shares: String(post?.shares ?? ""),
    saves: String(post?.saves ?? ""),
  });
  const [pending, start] = useTransition();
  const num = (k: keyof typeof f, label: string) => (
    <label className="block">
      <span className="mb-1 block text-[11px] text-white/45">{label}</span>
      <input className={field} inputMode="numeric" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  return (
    <Modal title={post ? "Update the numbers" : "Add a post"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <select className={field} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {PLATFORM[a.platform].label} @{a.handle}
              </option>
            ))}
          </select>
          <select className={field} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {["post", "reel", "video", "carousel", "story"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <input className={field} type="datetime-local" value={f.postedAt} onChange={(e) => setF({ ...f, postedAt: e.target.value })} />
        <input className={field} placeholder="Link to the post" value={f.permalink} onChange={(e) => setF({ ...f, permalink: e.target.value })} />
        <textarea className={`${field} h-20 py-2.5`} placeholder="Caption" value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} />
        <div className="grid grid-cols-3 gap-2">
          {num("views", "Views")}
          {num("reach", "Reach")}
          {num("likes", "Likes")}
          {num("comments", "Comments")}
          {num("shares", "Shares")}
          {num("saves", "Saves")}
        </div>
        <button
          type="button"
          disabled={pending || !f.accountId}
          onClick={() =>
            start(async () => {
              const r = await savePost({
                id: post?.id,
                accountId: f.accountId,
                postedAt: f.postedAt,
                kind: f.kind,
                caption: f.caption,
                permalink: f.permalink,
                views: Number(f.views),
                reach: Number(f.reach),
                likes: Number(f.likes),
                comments: Number(f.comments),
                shares: Number(f.shares),
                saves: Number(f.saves),
              });
              if (r.error) return showToast(r.error, "error");
              haptics.success();
              onClose();
            })
          }
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-semibold text-ink"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Save
        </button>
      </div>
    </Modal>
  );
}
