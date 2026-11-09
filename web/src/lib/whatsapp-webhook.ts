import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Meta's webhook handshake for the Gymix number: the verify token entered in
// the Meta app is derived from the app secret, so there's nothing else to keep.
export function gymixVerifyToken(appSecret: string) {
  return createHmac("sha256", appSecret).update("gymix-whatsapp-webhook").digest("hex").slice(0, 24);
}

// X-Hub-Signature-256: "sha256=" + HMAC-SHA256 of the raw body with the app secret.
export function validSignature(raw: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(raw).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}
