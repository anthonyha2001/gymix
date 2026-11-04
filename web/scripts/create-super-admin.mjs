// Creates (or updates) a Gymix platform super admin.
//
// Usage (from web/):
//   SUPABASE_SERVICE_ROLE_KEY=... ADMIN_PASSWORD=... node scripts/create-super-admin.mjs you@example.com "Your Name"
// NEXT_PUBLIC_SUPABASE_URL is read from .env.local if not set. The password is
// never stored in the repo: pass it in the environment when you run this.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [email, fullName = ""] = process.argv.slice(2);
const password = process.env.ADMIN_PASSWORD;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) {
  try {
    url = readFileSync(new URL("../.env.local", import.meta.url), "utf8").match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  } catch {}
}

if (!email || !password || !serviceKey || !url) {
  console.error("Usage: SUPABASE_SERVICE_ROLE_KEY=... ADMIN_PASSWORD=... node scripts/create-super-admin.mjs <email> [full name]");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Find an existing account with this email, else create one (already confirmed).
const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw error;
  console.log(`Updated password for existing account ${email}`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  user = data.user;
  console.log(`Created account ${email}`);
}

const { error: adminError } = await admin.from("platform_admins").upsert({ user_id: user.id });
if (adminError) throw adminError;
console.log(`${email} is now a Gymix super admin. Log in and open /admin.`);
