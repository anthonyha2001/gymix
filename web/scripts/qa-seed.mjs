// Seeds a LOCAL test gym (QA Iron House, a lab gym): owner, front desk, two
// members, plans and a paid membership. Idempotent. Never point it at production.
//   SERVICE_KEY=... ANON_KEY=... node scripts/qa-seed.mjs   (keys: npx supabase status -o env)
// Logins: owner@qa.gymix, desk@qa.gymix, nour@qa.gymix (password printed at the end).
import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54321"; // local Supabase only
const SERVICE = process.env.SERVICE_KEY;
const ANON = process.env.ANON_KEY;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const PASSWORD = "GymixTest!2026";

async function user(email, fullName) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const found = list.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) throw error;
  return data.user.id;
}
async function as(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

await user("owner@qa.gymix", "Maya Saliba");
await user("desk@qa.gymix", "Joe Nassif");
await user("nour@qa.gymix", "Nour Khalil");

const owner = await as("owner@qa.gymix");
let { data: gu } = await owner.from("gym_users").select("gym_id").limit(1).maybeSingle();
let gymId = gu?.gym_id;
if (!gymId) {
  const { data, error } = await owner.rpc("create_gym", { p_name: "QA Iron House" });
  if (error) throw error;
  gymId = data;
  const { data: me0 } = await owner.auth.getUser();
  const { error: invErr } = await owner.from("invites").insert([
    { gym_id: gymId, email: "desk@qa.gymix", role: "front_desk", invited_by: me0.user.id },
    { gym_id: gymId, email: "nour@qa.gymix", role: "member", invited_by: me0.user.id },
  ]);
  if (invErr) throw invErr;
  for (const e of ["desk@qa.gymix", "nour@qa.gymix"]) {
    const c = await as(e);
    const { error: cErr } = await c.rpc("claim_my_invites");
    if (cErr) throw cErr;
  }
  const { error: pErr } = await owner.from("membership_plans").insert([
    { gym_id: gymId, name: "Monthly", price_usd: 45, period: "month" },
    { gym_id: gymId, name: "Yearly", price_usd: 420, period: "year" },
  ]);
  if (pErr) throw pErr;
}
const { data: plan } = await owner.from("membership_plans").select("id").eq("gym_id", gymId).eq("name", "Monthly").single();
const { data: nour } = await owner.from("members").select("id").eq("gym_id", gymId).eq("email", "nour@qa.gymix").single();
const { data: ms } = await owner.from("memberships").select("id").eq("member_id", nour.id).limit(1).maybeSingle();
if (!ms) {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await owner.rpc("sell_membership", { p_member_id: nour.id, p_plan_id: plan.id, p_starts_on: today, p_paid_usd: 45, p_method: "cash_usd" });
  if (error) throw error;
}
const { data: rami } = await owner.from("members").select("id").eq("gym_id", gymId).eq("full_name", "Rami Haddad").maybeSingle();
if (!rami) {
  const { data: me } = await owner.auth.getUser();
  await owner.from("members").insert({ gym_id: gymId, full_name: "Rami Haddad", phone: "70111222", created_by: me.user.id });
}
// Lab gym: new features (rollout "lab") are on here.
await admin.from("gyms").update({ is_lab: true }).eq("id", gymId);
console.log(JSON.stringify({ gymId, password: PASSWORD }));
