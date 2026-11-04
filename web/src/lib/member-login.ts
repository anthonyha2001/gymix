import "server-only";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";

// Easy to read out loud and type on a phone: three groups of four, no look-alike
// characters (no 0/o, 1/l/i). About 59 bits of randomness.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function generatePassword() {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

// What the member types in the login box: their real email, else their phone,
// else their member code (always works).
export function memberLoginId(m: { email: string | null; phone: string | null; checkin_code: string }) {
  return m.email || m.phone || m.checkin_code;
}

export type NewLogin = { loginId: string; code: string; password: string };

// The first login details are shown once, right after joining, then forgotten.
const COOKIE = "gymix_new_login";

export async function rememberNewLogin(login: NewLogin) {
  (await cookies()).set(COOKIE, JSON.stringify(login), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 30 });
}

export async function readNewLogin(): Promise<NewLogin | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NewLogin;
  } catch {
    return null;
  }
}

export async function forgetNewLogin() {
  (await cookies()).delete(COOKIE);
}
